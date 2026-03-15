import { DynamicModule, Logger, Module, Provider } from "@nestjs/common";
import { Pool } from "pg";
import { Connection } from "mongoose";
import { RetrieverTokens } from "./retriever.tokens";
import { DocumentUtilsService } from "./utils/document-utils.service";
import { EmbeddingsService, EmbeddingsConfig } from "./utils/embeddings.service";
import { KnowledgeRetrieverService } from "./services/knowledge-retriever.service";
import { TempRetrieverService } from "./services/temp-retriever.service";
import { MongoVectorStore, MongoVectorStoreConfig } from "./providers/mongo-vector.store";
import { PostgresVectorStore, PostgresVectorStoreConfig } from "./providers/postgres-vector.store";

export type VectorStoreType = "postgres" | "mongodb";

export interface RetrieverModuleOptions {
  /** Which vector store backend to use. */
  vectorStore: VectorStoreType;

  /** Embeddings config (pass a pre-built instance or OpenAI API key). */
  embeddings?: EmbeddingsConfig;

  /** Required when vectorStore = "postgres". */
  postgres?: {
    pool: Pool;
    knowledge?: PostgresVectorStoreConfig;
    temp?: PostgresVectorStoreConfig;
  };

  /** Required when vectorStore = "mongodb". */
  mongodb?: {
    connection: Connection;
    knowledge: MongoVectorStoreConfig;
    temp?: MongoVectorStoreConfig;
  };
}

const logger = new Logger("RetrieverModule");

@Module({})
export class RetrieverModule {
  static forRoot(options: RetrieverModuleOptions): DynamicModule {
    const embeddingsService = new EmbeddingsService(options.embeddings ?? {});

    const documentUtilsProvider: Provider = {
      provide: DocumentUtilsService,
      useClass: DocumentUtilsService,
    };

    const embeddingsProvider: Provider = {
      provide: EmbeddingsService,
      useValue: embeddingsService,
    };

    const persistenceVectorStoreProvider: Provider = {
      provide: RetrieverTokens.PERSISTENCE_VECTOR_STORE,
      useFactory: (docutils: DocumentUtilsService) => {
        if (options.vectorStore === "postgres") {
          if (!options.postgres) throw new Error("RetrieverModule: postgres config required");
          logger.log("Creating PostgresVectorStore for knowledge collection");
          return new PostgresVectorStore(
            options.postgres.pool,
            embeddingsService,
            options.postgres.knowledge ?? { tableName: "kms_embeddings" },
          );
        }

        if (!options.mongodb) throw new Error("RetrieverModule: mongodb config required");
        logger.log("Creating MongoVectorStore for knowledge collection");
        return new MongoVectorStore(
          options.mongodb.connection,
          embeddingsService,
          docutils,
          options.mongodb.knowledge,
        );
      },
      inject: [DocumentUtilsService],
    };

    const tempVectorStoreProvider: Provider = {
      provide: RetrieverTokens.TEMP_VECTOR_STORE,
      useFactory: (docutils: DocumentUtilsService) => {
        if (options.vectorStore === "postgres") {
          if (!options.postgres) throw new Error("RetrieverModule: postgres config required");
          logger.log("Creating PostgresVectorStore for temp collection");
          return new PostgresVectorStore(
            options.postgres.pool,
            embeddingsService,
            options.postgres.temp ?? { tableName: "kms_temp_embeddings" },
          );
        }

        if (!options.mongodb) throw new Error("RetrieverModule: mongodb config required");
        const tempConfig = options.mongodb.temp ?? {
          ...options.mongodb.knowledge,
          collectionName: "tempContext",
          indexName: "tempVectorIndex",
          textIndexName: "tempSearchIndex",
        };
        logger.log("Creating MongoVectorStore for temp collection");
        return new MongoVectorStore(
          options.mongodb.connection,
          embeddingsService,
          docutils,
          tempConfig,
        );
      },
      inject: [DocumentUtilsService],
    };

    return {
      module: RetrieverModule,
      providers: [
        documentUtilsProvider,
        embeddingsProvider,
        persistenceVectorStoreProvider,
        tempVectorStoreProvider,
        {
          provide: RetrieverTokens.KNOWLEDGE_RETRIEVER,
          useClass: KnowledgeRetrieverService,
        },
        {
          provide: RetrieverTokens.TEMP_RETRIEVER,
          useClass: TempRetrieverService,
        },
      ],
      exports: [
        RetrieverTokens.KNOWLEDGE_RETRIEVER,
        RetrieverTokens.TEMP_RETRIEVER,
        DocumentUtilsService,
        EmbeddingsService,
      ],
    };
  }
}
