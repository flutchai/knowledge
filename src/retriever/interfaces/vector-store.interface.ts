import { DocumentInterface } from "@langchain/core/documents";
import { Document } from "@langchain/core/documents";
import { RetrieverSearchType } from "../../shared/enums";
import { RetrieveQueryOptions } from "../types";

export interface IVectorStore {
  addDocuments(documents: Document[], options?: { ids?: string[] }): Promise<string[]>;
  delete(params: { ids: string[] }): Promise<void>;
  vectorSearch(
    query: string,
    searchType: RetrieverSearchType,
    options?: RetrieveQueryOptions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<DocumentInterface<Record<string, any>>[] | null>;
  textSearch(
    query: string,
    options?: RetrieveQueryOptions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<DocumentInterface<Record<string, any>>[] | null>;
  getChunkById(chunkId: string): Promise<unknown>;
  getChunksForDocument(articleId: string): Promise<unknown[]>;
}
