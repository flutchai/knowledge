import { DocumentInterface } from "@langchain/core/documents";
import { RetrieverSearchType } from "../../shared/enums";
import { ISplitOptions } from "../../shared/types";
import { CustomDocument, RetrieveQueryOptions } from "../types";

export interface IKnowledgeRetrieverService {
  addDocuments(
    docs: DocumentInterface[],
    knowledgeBaseId: string,
    splitOptions?: ISplitOptions,
    ids?: string[]
  ): Promise<string[]>;
  updateDocuments(
    docs: DocumentInterface[],
    ids: string[],
    knowledgeBaseId: string,
    splitOptions?: ISplitOptions
  ): Promise<string[]>;
  deleteDocuments(ids: string[]): Promise<void>;
  search(
    query: string,
    searchType: RetrieverSearchType,
    knowledgeBaseIds: string[],
    options?: RetrieveQueryOptions
  ): Promise<CustomDocument[]>;
  getChunkById(chunkId: string): Promise<any>;
  getChunksForDocument(articleId: string): Promise<any[]>;
}

export interface ITempRetrieverService {
  addDocuments(
    docs: DocumentInterface[],
    splitOptions?: ISplitOptions,
    ids?: string[]
  ): Promise<string[]>;
  updateDocuments(
    docs: DocumentInterface[],
    ids: string[],
    splitOptions?: ISplitOptions
  ): Promise<void>;
  deleteDocuments(ids: string[]): Promise<void>;
  search(
    query: string,
    searchType: RetrieverSearchType,
    options?: RetrieveQueryOptions
  ): Promise<DocumentInterface<Record<string, any>>[] | null>;
}
