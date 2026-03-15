import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Pool } from "pg";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { EmbeddingsService } from "../utils/embeddings.service";
import { IVectorStore } from "../interfaces/vector-store.interface";
import { RetrieveQueryOptions } from "../types";
import { RetrieverSearchType } from "../../shared/enums";

export interface PostgresVectorStoreConfig {
  /** Table name for storing vectors. Defaults to "kms_embeddings". */
  tableName?: string;
  /** Number of dimensions for the embedding model. Defaults to 1536 (ada-002). */
  dimensions?: number;
}

/**
 * PostgreSQL vector store using pgvector extension.
 *
 * Table schema (auto-created on init):
 *   id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
 *   content     TEXT
 *   metadata    JSONB
 *   embedding   vector(<dimensions>)
 */
@Injectable()
export class PostgresVectorStore implements IVectorStore, OnModuleInit {
  private readonly logger = new Logger(PostgresVectorStore.name);
  private readonly tableName: string;
  private readonly dimensions: number;

  constructor(
    private readonly pool: Pool,
    private readonly embeddingsService: EmbeddingsService,
    config: PostgresVectorStoreConfig = {}
  ) {
    this.tableName = config.tableName ?? "kms_embeddings";
    this.dimensions = config.dimensions ?? 1536;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureTable();
    this.logger.log(
      `PostgresVectorStore initialized — table: ${this.tableName}, dimensions: ${this.dimensions}`
    );
  }

  private async ensureTable(): Promise<void> {
    await this.pool.query(`
      DO $$ BEGIN
        CREATE EXTENSION IF NOT EXISTS vector;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END; $$
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content     TEXT NOT NULL,
        metadata    JSONB NOT NULL DEFAULT '{}',
        embedding   vector(${this.dimensions})
      )
    `);
    // Index for cosine similarity search
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS ${this.tableName}_embedding_idx
      ON ${this.tableName}
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
    // GIN index for full-text search on metadata + content
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS ${this.tableName}_content_fts_idx
      ON ${this.tableName}
      USING gin (to_tsvector('english', content))
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS ${this.tableName}_metadata_idx
      ON ${this.tableName}
      USING gin (metadata)
    `);
  }

  async addDocuments(
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<string[]> {
    if (documents.length === 0) return [];

    const embeddings = await this.embeddingsService
      .createEmbeddings()
      .embedDocuments(documents.map(d => d.pageContent));

    const ids: string[] = [];
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const embedding = embeddings[i];
        const providedId = options?.ids?.[i];

        const vector = `[${embedding.join(",")}]`;

        let result;
        if (providedId) {
          result = await client.query(
            `INSERT INTO ${this.tableName} (id, content, metadata, embedding)
             VALUES ($1, $2, $3, $4::vector)
             ON CONFLICT (id) DO UPDATE
               SET content = EXCLUDED.content,
                   metadata = EXCLUDED.metadata,
                   embedding = EXCLUDED.embedding
             RETURNING id`,
            [providedId, doc.pageContent, JSON.stringify(doc.metadata), vector]
          );
        } else {
          result = await client.query(
            `INSERT INTO ${this.tableName} (content, metadata, embedding)
             VALUES ($1, $2, $3::vector)
             RETURNING id`,
            [doc.pageContent, JSON.stringify(doc.metadata), vector]
          );
        }

        ids.push(result.rows[0].id);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      this.logger.error("Failed to add documents to Postgres:", error);
      throw error;
    } finally {
      client.release();
    }

    this.logger.log(`Added ${ids.length} documents to ${this.tableName}`);
    return ids;
  }

  async delete(params: { ids: any[] }): Promise<void> {
    if (params.ids.length === 0) return;

    const placeholders = params.ids.map((_, i) => `$${i + 1}`).join(", ");
    await this.pool.query(
      `DELETE FROM ${this.tableName} WHERE id IN (${placeholders})`,
      params.ids
    );
  }

  async vectorSearch(
    query: string,
    searchType: RetrieverSearchType,
    options?: RetrieveQueryOptions
  ): Promise<DocumentInterface<Record<string, any>>[] | null> {
    try {
      const limit = options?.limit ?? 5;
      const queryEmbedding = await this.embeddingsService
        .createEmbeddings()
        .embedQuery(query);

      const vector = `[${queryEmbedding.join(",")}]`;

      // Build WHERE clause from filter (expects { knowledgeBaseId: { $in: [...] } } style)
      const { whereClause, params } = this.buildWhereClause(options?.filter, [vector]);

      let sql: string;

      if (searchType === RetrieverSearchType.Similarity) {
        // Cosine similarity: 1 - (embedding <=> query_vector)
        sql = `
          SELECT
            id::text,
            content,
            metadata,
            1 - (embedding <=> $1::vector) AS score
          FROM ${this.tableName}
          ${whereClause}
          ORDER BY embedding <=> $1::vector
          LIMIT ${limit}
        `;
      } else if (searchType === RetrieverSearchType.MMR) {
        // For MMR we do a simple similarity search (true MMR requires multiple passes)
        const fetchK = options?.fetchK ?? limit * 2;
        sql = `
          SELECT
            id::text,
            content,
            metadata,
            1 - (embedding <=> $1::vector) AS score
          FROM ${this.tableName}
          ${whereClause}
          ORDER BY embedding <=> $1::vector
          LIMIT ${fetchK}
        `;
      } else {
        return null;
      }

      const result = await this.pool.query(sql, params);

      let docs = result.rows.map(row => ({
        pageContent: row.content,
        metadata: { ...(row.metadata ?? {}), score: row.score },
      }));

      if (
        searchType === RetrieverSearchType.Similarity &&
        typeof options?.scoreThreshold === "number"
      ) {
        docs = docs.filter(d => (d.metadata.score ?? 0) >= options.scoreThreshold!);
      }

      // Simple MMR reranking: pick diverse results
      if (searchType === RetrieverSearchType.MMR) {
        docs = this.mmrRerank(docs, options?.limit ?? 5, options?.lambda ?? 0.8);
      }

      return docs;
    } catch (error) {
      this.logger.error("Postgres vectorSearch failed:", error);
      return null;
    }
  }

  async textSearch(
    query: string,
    options?: RetrieveQueryOptions
  ): Promise<DocumentInterface<Record<string, any>>[] | null> {
    try {
      const limit = options?.limit ?? 5;
      const { whereClause, params } = this.buildWhereClause(options?.filter, [query]);

      const sql = `
        SELECT
          id::text,
          content,
          metadata,
          ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) AS score
        FROM ${this.tableName}
        ${whereClause}
          AND to_tsvector('english', content) @@ plainto_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT ${limit}
      `;

      const result = await this.pool.query(sql, params);
      return result.rows.map(row => ({
        pageContent: row.content,
        metadata: { ...(row.metadata ?? {}), score: row.score },
      }));
    } catch (error) {
      this.logger.error("Postgres textSearch failed:", error);
      return null;
    }
  }

  async getChunkById(chunkId: string): Promise<any> {
    try {
      const result = await this.pool.query(
        `SELECT id::text, content, metadata FROM ${this.tableName} WHERE id = $1`,
        [chunkId]
      );
      return result.rows[0] ?? null;
    } catch (error) {
      this.logger.error(`getChunkById failed for '${chunkId}':`, error);
      return null;
    }
  }

  async getChunksForDocument(articleId: string): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT id::text, content, metadata
         FROM ${this.tableName}
         WHERE metadata->>'articleId' = $1
            OR metadata->>'docId' = $1`,
        [articleId]
      );
      return result.rows;
    } catch (error) {
      this.logger.error(`getChunksForDocument failed for '${articleId}':`, error);
      return [];
    }
  }

  /**
   * Build a WHERE clause from a filter object.
   * Supports: { knowledgeBaseId: { $in: [...] } } and { key: value }.
   * params[0] is always the first query param (embedding vector or search query).
   */
  private buildWhereClause(
    filter: Record<string, any> | undefined,
    baseParams: any[]
  ): { whereClause: string; params: any[] } {
    const params = [...baseParams];
    const conditions: string[] = [];

    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        if (value && typeof value === "object" && "$in" in value) {
          const arr = value.$in as any[];
          if (arr.length > 0) {
            const idxStart = params.length + 1;
            arr.forEach(v => params.push(v));
            const placeholders = arr.map((_, i) => `$${idxStart + i}`).join(", ");
            conditions.push(`metadata->>'${key}' IN (${placeholders})`);
          }
        } else {
          params.push(value);
          conditions.push(`metadata->>'${key}' = $${params.length}`);
        }
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { whereClause, params };
  }

  /**
   * Simple greedy MMR reranking over pre-fetched candidates.
   * lambda=1 → pure relevance, lambda=0 → max diversity.
   */
  private mmrRerank(
    docs: DocumentInterface<Record<string, any>>[],
    k: number,
    lambda: number
  ): DocumentInterface<Record<string, any>>[] {
    if (docs.length <= k) return docs;
    const selected: DocumentInterface<Record<string, any>>[] = [];
    const remaining = [...docs];

    while (selected.length < k && remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const relevance = remaining[i].metadata.score ?? 0;
        const maxSim =
          selected.length === 0
            ? 0
            : Math.max(
                ...selected.map(s =>
                  this.cosineSimilarityFromScores(
                    remaining[i].metadata.score ?? 0,
                    s.metadata.score ?? 0
                  )
                )
              );
        const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      selected.push(remaining[bestIdx]);
      remaining.splice(bestIdx, 1);
    }

    return selected;
  }

  private cosineSimilarityFromScores(a: number, b: number): number {
    // Rough approximation from relevance scores (not true cosine)
    return 1 - Math.abs(a - b);
  }
}
