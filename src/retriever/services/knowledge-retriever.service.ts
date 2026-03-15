import { Injectable, Inject, Logger } from "@nestjs/common";
import { DocumentInterface } from "@langchain/core/documents";
import { CustomDocument, CustomDocumentMetadata, RetrieveQueryOptions } from "../types";
import { IVectorStore } from "../interfaces/vector-store.interface";
import { DocumentUtilsService } from "../utils/document-utils.service";
import { RetrieverTokens } from "../retriever.tokens";
import { RetrieverSearchType } from "../../shared/enums";
import { ISplitOptions } from "../../shared/types";
import { IKnowledgeRetrieverService } from "../interfaces/retriever.interface";

@Injectable()
export class KnowledgeRetrieverService implements IKnowledgeRetrieverService {
  private readonly logger = new Logger(KnowledgeRetrieverService.name);

  constructor(
    @Inject(RetrieverTokens.PERSISTENCE_VECTOR_STORE)
    private readonly vectorStore: IVectorStore,
    private readonly documentUtils: DocumentUtilsService,
  ) {}

  async addDocuments(
    docs: DocumentInterface[],
    knowledgeBaseId: string,
    splitOptions?: ISplitOptions,
    ids?: string[],
  ): Promise<string[]> {
    const createdAt = new Date().toISOString();

    docs = docs.map((doc) => ({
      ...doc,
      pageContent: DocumentUtilsService.cleanNoIndex(doc.pageContent),
      metadata: { ...doc.metadata, knowledgeBaseId, createdAt },
    }));

    if (splitOptions?.enabled) {
      docs = await this.documentUtils.splitDocsToChunks(docs, splitOptions);
    }

    this.logger.log(`Adding ${docs.length} documents to vector store`);
    return this.vectorStore.addDocuments(docs, { ids });
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    return this.vectorStore.delete({ ids });
  }

  async updateDocuments(
    docs: CustomDocument[],
    ids: string[],
    knowledgeBaseId: string,
    splitOptions?: ISplitOptions,
  ): Promise<string[]> {
    this.logger.log(`Updating ${docs.length} documents, deleting ${ids.length} old chunks`);
    try {
      await this.vectorStore.delete({ ids });
    } catch (error) {
      this.logger.error("Failed to delete old chunks:", error);
    }

    const newIds = await this.addDocuments(docs, knowledgeBaseId, splitOptions);
    this.logger.log(`Updated documents: created ${newIds.length} new chunks`);
    return newIds;
  }

  async search(
    query: string,
    searchType: RetrieverSearchType,
    knowledgeBaseIds: string[],
    options?: RetrieveQueryOptions,
  ): Promise<CustomDocument[]> {
    const mergedOptions = {
      ...options,
      filter: {
        ...options?.filter,
        knowledgeBaseId: { $in: knowledgeBaseIds },
      },
    };

    this.logger.log(`Searching for "${query}"`, { searchType, knowledgeBaseIds });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- LangChain DocumentInterface metadata type
    let results: DocumentInterface<Record<string, any>>[] = [];

    if (searchType === RetrieverSearchType.Similarity || searchType === RetrieverSearchType.MMR) {
      results = (await this.vectorStore.vectorSearch(query, searchType, mergedOptions)) ?? [];
    } else if (searchType === RetrieverSearchType.Search) {
      results = (await this.vectorStore.textSearch(query, mergedOptions)) ?? [];
    }

    const customDocs: CustomDocument[] = results.map((doc) => ({
      ...doc,
      pageContent: DocumentUtilsService.cleanRAGMeta(doc.pageContent),
      metadata: {
        ...(doc.metadata as Partial<CustomDocumentMetadata>),
        knowledgeBaseId: (doc.metadata?.knowledgeBaseId ?? "unknown").toString(),
      },
    }));

    return customDocs.filter(
      (d) =>
        d.metadata.knowledgeBaseId !== null &&
        knowledgeBaseIds.includes(d.metadata.knowledgeBaseId),
    );
  }

  async getChunkById(chunkId: string): Promise<unknown> {
    return this.vectorStore.getChunkById(chunkId);
  }

  async getChunksForDocument(articleId: string): Promise<unknown[]> {
    return this.vectorStore.getChunksForDocument(articleId);
  }
}
