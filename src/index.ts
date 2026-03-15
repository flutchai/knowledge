// Modules
export {
  RetrieverModule,
  RetrieverModuleOptions,
  VectorStoreType,
} from "./retriever/retriever.module";
export { KmsModule, KmsModuleOptions } from "./kms/kms.module";

// Tokens
export { RetrieverTokens } from "./retriever/retriever.tokens";
export { KmsTokens } from "./kms/kms.tokens";

// Retriever interfaces & types
export {
  IKnowledgeRetrieverService,
  ITempRetrieverService,
} from "./retriever/interfaces/retriever.interface";
export { IVectorStore } from "./retriever/interfaces/vector-store.interface";
export { CustomDocument, CustomDocumentMetadata, RetrieveQueryOptions } from "./retriever/types";

// Vector store providers
export {
  PostgresVectorStore,
  PostgresVectorStoreConfig,
} from "./retriever/providers/postgres-vector.store";
export { MongoVectorStore, MongoVectorStoreConfig } from "./retriever/providers/mongo-vector.store";

// Services
export { EmbeddingsService, EmbeddingsConfig } from "./retriever/utils/embeddings.service";
export { DocumentUtilsService } from "./retriever/utils/document-utils.service";
export { KnowledgeRetrieverService } from "./retriever/services/knowledge-retriever.service";
export { TempRetrieverService } from "./retriever/services/temp-retriever.service";
export { AdminKnowledgeBaseService } from "./kms/services/admin-kb.service";
export { SearchService } from "./kms/services/search.service";

// KMS interfaces
export { IKnowledgeBaseRepository } from "./kms/interfaces/kb-repository.interface";
export { IArticleRepository } from "./kms/interfaces/article-repository.interface";

// DTOs
export { CreateKnowledgeBaseDto } from "./kms/dto/create-knowledge-base.dto";
export { UpdateKnowledgeBaseDto } from "./kms/dto/update-knowledge-base.dto";

// Shared enums & types
export {
  RetrieverSearchType,
  SplitType,
  AttachmentType,
  KnowledgeBaseStatus,
  KnowledgeBaseOwnership,
  KnowledgeBaseContentType,
  VisibilityLevel,
  ArticleSource,
} from "./shared/enums";

export {
  CHUNKING_DEFAULTS,
  DEFAULT_SEPARATORS,
  TEXT_PROCESSING_VALIDATION,
  ISplitOptions,
  IAttachment,
  IKnowledgeBase,
  ICreateKnowledgeBase,
  IUpdateKnowledgeBase,
  IKBSettings,
  IKBStats,
  IArticle,
  ICreateArticle,
  IUpdateArticle,
  IArticleContent,
  IArticleEmailMetadata,
  IArticleExtra,
  PaginationOptions,
  PaginatedResult,
  IBaseEntity,
} from "./shared/types";
