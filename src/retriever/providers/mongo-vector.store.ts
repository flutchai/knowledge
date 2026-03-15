import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Connection } from "mongoose";
import { ObjectId } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { DocumentInterface } from "@langchain/core/documents";
import { EmbeddingsService } from "../utils/embeddings.service";
import { IVectorStore } from "../interfaces/vector-store.interface";
import { RetrieveQueryOptions } from "../types";
import { DocumentUtilsService } from "../utils/document-utils.service";
import { RetrieverSearchType } from "../../shared/enums";

export interface MongoVectorStoreConfig {
  collectionName: string;
  indexName: string;
  textIndexName: string;
  retrieveK?: number;
  fetchK?: number;
  lambda?: number;
}

@Injectable()
export class MongoVectorStore
  extends MongoDBAtlasVectorSearch
  implements IVectorStore, OnModuleInit
{
  private readonly logger = new Logger(MongoVectorStore.name);
  private readonly textIndexName: string;
  private readonly _collectionName: string;
  private readonly _config: MongoVectorStoreConfig;

  constructor(
    readonly connection: Connection,
    readonly embeddingsService: EmbeddingsService,
    readonly docutils: DocumentUtilsService,
    config: MongoVectorStoreConfig
  ) {
    super(embeddingsService.createEmbeddings(), {
      // Cast to any: mongoose and @langchain/mongodb may bundle different mongodb minor versions
      collection: connection.db!.collection(config.collectionName) as any,
      indexName: config.indexName,
      textKey: "text",
      embeddingKey: "embedding",
    });
    this._config = config;
    this.textIndexName = config.textIndexName;
    this._collectionName = config.collectionName;
  }

  async onModuleInit() {
    this.logger.log(`MongoVectorStore initialized`, {
      collection: this._collectionName,
      textIndexName: this.textIndexName,
    });
  }

  public async vectorSearch(
    query: string,
    searchType: RetrieverSearchType = RetrieverSearchType.MMR,
    options?: RetrieveQueryOptions
  ): Promise<DocumentInterface<Record<string, any>>[] | null> {
    try {
      if (searchType === RetrieverSearchType.Similarity) {
        const mongoFilter = options?.filter ? { preFilter: options.filter } : undefined;
        const rawLimit = options?.limit;
        const limit =
          typeof rawLimit === "string" ? parseInt(rawLimit, 10) : rawLimit || 5;

        const retrievedDocsWithScores = await this.similaritySearchWithScore(
          query,
          limit,
          mongoFilter
        );

        let retrievedDocs = retrievedDocsWithScores.map(([doc, score]) => ({
          ...doc,
          metadata: { ...(doc.metadata || {}), score },
        }));

        if (typeof options?.scoreThreshold === "number") {
          retrievedDocs = retrievedDocs.filter(
            doc => (doc.metadata?.score ?? 0) >= options.scoreThreshold!
          );
        }

        return retrievedDocs;
      } else if (searchType === RetrieverSearchType.MMR) {
        const mongoFilter = options?.filter ? { preFilter: options.filter } : undefined;
        const rawLimit = options?.limit;
        const numericLimit =
          typeof rawLimit === "string" ? parseInt(rawLimit, 10) : rawLimit;

        const mmrOptions = {
          k: numericLimit || this._config.retrieveK || 5,
          fetchK: options?.fetchK || this._config.fetchK || 10,
          lambda: options?.lambda || this._config.lambda || 0.8,
          filter: mongoFilter,
        };
        return await this.maxMarginalRelevanceSearch(query, mmrOptions);
      }
      return null;
    } catch (error) {
      this.logger.error("Error retrieving documents:", error);
      return null;
    }
  }

  public async textSearch(
    query: string,
    options?: RetrieveQueryOptions
  ): Promise<DocumentInterface<Record<string, any>>[] | null> {
    try {
      const collection = this.connection.collection(this._collectionName);
      const rawLimit = options?.limit;
      const limit =
        typeof rawLimit === "string" ? parseInt(rawLimit, 10) : rawLimit || 5;

      const pipeline = [
        { $search: { index: this.textIndexName, text: { query, path: "text" } } },
        { $match: options?.filter || {} },
        { $limit: limit },
      ];

      const results = await collection.aggregate(pipeline).toArray();
      return results as DocumentInterface<Record<string, any>>[];
    } catch (error) {
      this.logger.error("Text search failed", error);
      return null;
    }
  }

  async delete(params: { ids: any[] }): Promise<void> {
    try {
      const collection = this.connection.collection(this._collectionName);
      const objectIds = params.ids.map(id =>
        typeof id === "string" ? new ObjectId(id) : new ObjectId(String(id))
      );
      const result = await collection.deleteMany({ _id: { $in: objectIds } });
      if (result.deletedCount !== params.ids.length) {
        this.logger.warn(
          `Expected to delete ${params.ids.length} docs, deleted ${result.deletedCount}`
        );
      }
    } catch (error) {
      this.logger.error("MongoVectorStore delete failed:", error);
      throw error;
    }
  }

  async getChunkById(chunkId: string): Promise<any> {
    try {
      const collection = this.connection.collection(this._collectionName);
      return await collection.findOne({ _id: new ObjectId(chunkId) });
    } catch (error) {
      this.logger.error(`Failed to get chunk by ID '${chunkId}':`, error);
      return null;
    }
  }

  async getChunksForDocument(articleId: string): Promise<any[]> {
    try {
      const collection = this.connection.collection(this._collectionName);
      return await collection
        .find({
          $or: [
            { "metadata.articleId": articleId },
            { "metadata.docId": articleId },
            { articleId },
            { docId: articleId },
          ],
        })
        .toArray();
    } catch (error) {
      this.logger.error(`Failed to get chunks for article '${articleId}':`, error);
      return [];
    }
  }
}
