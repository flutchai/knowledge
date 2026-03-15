import { DocumentInterface } from "@langchain/core/documents";
import { Document } from "@langchain/core/documents";
import { RetrieverSearchType } from "../../shared/enums";
import { RetrieveQueryOptions } from "../types";

export interface IVectorStore {
  addDocuments(
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<any[]>;
  delete(params: { ids: any[] }): Promise<void>;
  vectorSearch(
    query: string,
    searchType: RetrieverSearchType,
    options?: RetrieveQueryOptions
  ): Promise<DocumentInterface<Record<string, any>>[] | null>;
  textSearch(
    query: string,
    options?: RetrieveQueryOptions
  ): Promise<DocumentInterface<Record<string, any>>[] | null>;
  getChunkById(chunkId: string): Promise<any>;
  getChunksForDocument(articleId: string): Promise<any[]>;
}
