import { Injectable, Inject } from "@nestjs/common";
import { DocumentInterface } from "@langchain/core/documents";
import { IVectorStore } from "../interfaces/vector-store.interface";
import { RetrieveQueryOptions } from "../types";
import { RetrieverSearchType } from "../../shared/enums";
import { ISplitOptions } from "../../shared/types";
import { RetrieverTokens } from "../retriever.tokens";
import { ITempRetrieverService } from "../interfaces/retriever.interface";
import { DocumentUtilsService } from "../utils/document-utils.service";

@Injectable()
export class TempRetrieverService implements ITempRetrieverService {
  constructor(
    @Inject(RetrieverTokens.TEMP_VECTOR_STORE)
    private readonly vectorStore: IVectorStore,
    private readonly documentUtils: DocumentUtilsService,
  ) {}

  async addDocuments(
    docs: DocumentInterface[],
    splitOptions?: ISplitOptions,
    ids?: string[],
  ): Promise<string[]> {
    if (splitOptions?.enabled) {
      docs = await this.documentUtils.splitDocsToChunks(docs, splitOptions);
    }
    return this.vectorStore.addDocuments(docs, { ids });
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    return this.vectorStore.delete({ ids });
  }

  async updateDocuments(docs: DocumentInterface[], ids: string[]): Promise<void> {
    await this.vectorStore.delete({ ids });
    await this.vectorStore.addDocuments(docs, { ids });
  }

  async search(
    query: string,
    searchType: RetrieverSearchType,
    options?: RetrieveQueryOptions,
  ): Promise<DocumentInterface[] | null> {
    if (searchType === RetrieverSearchType.Similarity || searchType === RetrieverSearchType.MMR) {
      return this.vectorStore.vectorSearch(query, searchType, options);
    } else if (searchType === RetrieverSearchType.Search) {
      return this.vectorStore.textSearch(query, options);
    }
    return null;
  }
}
