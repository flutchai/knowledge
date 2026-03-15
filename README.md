# @flutchai/knowledge

[![npm version](https://img.shields.io/npm/v/@flutchai/knowledge)](https://www.npmjs.com/package/@flutchai/knowledge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

NestJS library for knowledge base management with vector search. Provides article CRUD, text chunking, OpenAI embeddings, and RAG retrieval — backed by PostgreSQL (pgvector) or MongoDB.

## Requirements

- Node.js 18+
- NestJS 10+
- One of:
  - PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension enabled
  - MongoDB Atlas with a configured [Vector Search index](https://www.mongodb.com/docs/atlas/atlas-vector-search/create-index/)

## Installation

```bash
yarn add @flutchai/knowledge
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key for generating embeddings |
| `POSTGRES_HOST` | If using PostgreSQL | Database host |
| `POSTGRES_PORT` | If using PostgreSQL | Database port (default: `5432`) |
| `POSTGRES_USER` | If using PostgreSQL | Database user |
| `POSTGRES_PASSWORD` | If using PostgreSQL | Database password |
| `POSTGRES_DB` | If using PostgreSQL | Database name |
| `MONGODB_URI` | If using MongoDB | MongoDB connection URI |

## Quick Start

### 1. Implement the repository interfaces

The library is storage-agnostic. Wire it to your database by implementing two interfaces:

```ts
// kb.repository.ts
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  IKnowledgeBaseRepository,
  IKnowledgeBase,
  ICreateKnowledgeBase,
  IUpdateKnowledgeBase,
  PaginationOptions,
  PaginatedResult,
} from "@flutchai/knowledge";
import { KnowledgeBaseEntity } from "./knowledge-base.entity";

@Injectable()
export class KbRepository implements IKnowledgeBaseRepository {
  constructor(
    @InjectRepository(KnowledgeBaseEntity)
    private readonly repo: Repository<KnowledgeBaseEntity>
  ) {}

  async findById(id: string): Promise<IKnowledgeBase | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByCompany(companyId: string, options: PaginationOptions): Promise<PaginatedResult<IKnowledgeBase>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const [items, total] = await this.repo.findAndCount({
      where: { companyId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: "DESC" },
    });
    return { items, total, page, limit };
  }

  async findByOwner(ownerId: string, options: PaginationOptions): Promise<PaginatedResult<IKnowledgeBase>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const [items, total] = await this.repo.findAndCount({
      where: { ownerId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: "DESC" },
    });
    return { items, total, page, limit };
  }

  async create(data: ICreateKnowledgeBase): Promise<IKnowledgeBase> {
    return this.repo.save(this.repo.create(data as any));
  }

  async update(id: string, data: IUpdateKnowledgeBase): Promise<IKnowledgeBase | null> {
    await this.repo.update(id, data as any);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
```

```ts
// article.repository.ts
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  IArticleRepository,
  IArticle,
  ICreateArticle,
  IUpdateArticle,
  PaginationOptions,
  PaginatedResult,
} from "@flutchai/knowledge";
import { ArticleEntity } from "./article.entity";

@Injectable()
export class ArticleRepository implements IArticleRepository {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly repo: Repository<ArticleEntity>
  ) {}

  async findById(id: string): Promise<IArticle | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByKnowledgeBase(kbId: string, options: PaginationOptions): Promise<PaginatedResult<IArticle>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const [items, total] = await this.repo.findAndCount({
      where: { knowledgeBaseId: kbId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: "DESC" },
    });
    return { items, total, page, limit };
  }

  async create(data: ICreateArticle): Promise<IArticle> {
    return this.repo.save(this.repo.create(data as any));
  }

  async update(id: string, data: IUpdateArticle): Promise<IArticle | null> {
    await this.repo.update(id, data as any);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
```

### 2. Register KmsModule

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { Pool } from "pg";
import { KmsModule } from "@flutchai/knowledge";
import { TypeOrmModule } from "@nestjs/typeorm";
import { KbRepository } from "./kb.repository";
import { ArticleRepository } from "./article.repository";
import { KnowledgeBaseEntity } from "./knowledge-base.entity";
import { ArticleEntity } from "./article.entity";

const pgPool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

@Module({
  imports: [
    KmsModule.forRoot({
      retriever: {
        vectorStore: "postgres",
        postgres: {
          pool: pgPool,
          knowledge: { tableName: "kms_embeddings", dimensions: 1536 },
          temp: { tableName: "kms_temp_embeddings", dimensions: 1536 },
        },
        embeddings: {
          openAiApiKey: process.env.OPENAI_API_KEY,
          model: "text-embedding-ada-002",
        },
      },
      repositories: {
        knowledgeBase: KbRepository,
        article: ArticleRepository,
      },
      extraImports: [TypeOrmModule.forFeature([KnowledgeBaseEntity, ArticleEntity])],
    }),
  ],
})
export class AppModule {}
```

### 3. Inject SearchService and index articles

```ts
import { Injectable } from "@nestjs/common";
import { SearchService } from "@flutchai/knowledge";

@Injectable()
export class ArticleService {
  constructor(private readonly searchService: SearchService) {}

  async publishArticle(id: string): Promise<void> {
    // ... set isPublished = true, copy draftArticle → publishedArticle in your DB

    // then index it — chunking + embeddings + vector store, all handled by the lib
    await this.searchService.indexArticle(id);
  }

  async unpublishArticle(id: string): Promise<void> {
    // ... set isPublished = false in your DB

    await this.searchService.removeArticleFromIndex(id);
  }

  async updatePublishedArticle(id: string): Promise<void> {
    // ... update content in your DB

    await this.searchService.reindexArticle(id);
  }
}
```

## Using MongoDB instead of PostgreSQL

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import mongoose from "mongoose";
import { KmsModule } from "@flutchai/knowledge";

const mongooseConnection = mongoose.createConnection(process.env.MONGODB_URI);

@Module({
  imports: [
    KmsModule.forRoot({
      retriever: {
        vectorStore: "mongodb",
        mongodb: {
          connection: mongooseConnection,
          knowledge: {
            collectionName: "kms_embeddings",
            indexName: "vector_index",
            textIndexName: "text_index",
            dbName: "mydb",
          },
        },
        embeddings: {
          openAiApiKey: process.env.OPENAI_API_KEY,
        },
      },
      repositories: { knowledgeBase: KbRepository, article: ArticleRepository },
    }),
  ],
})
export class AppModule {}
```

## Using RetrieverModule standalone

If you only need vector search without the knowledge base management layer, you can register `RetrieverModule` directly:

```ts
import { Module } from "@nestjs/common";
import { RetrieverModule, RetrieverTokens, IKnowledgeRetrieverService } from "@flutchai/knowledge";

@Module({
  imports: [
    RetrieverModule.forRoot({
      vectorStore: "postgres",
      postgres: { pool: pgPool },
      embeddings: { openAiApiKey: process.env.OPENAI_API_KEY },
    }),
  ],
})
export class AppModule {}

// Inject in your service:
@Injectable()
export class MyService {
  constructor(
    @Inject(RetrieverTokens.KNOWLEDGE_RETRIEVER)
    private readonly retriever: IKnowledgeRetrieverService
  ) {}
}
```

## API Reference

### `SearchService`

| Method | Description |
|---|---|
| `indexArticle(articleId)` | Chunk, embed, and store a published article in the vector store. Saves chunk IDs back to the article. |
| `removeArticleFromIndex(articleId)` | Delete all chunks for an article from the vector store. |
| `reindexArticle(articleId)` | Update an already-indexed article (delete old chunks, insert new ones). |
| `search(query, searchType, kbId, options?)` | Search within a knowledge base. |

### `AdminKnowledgeBaseService`

| Method | Description |
|---|---|
| `create(dto)` | Create a knowledge base with default chunking settings. |
| `findById(kbId)` | Get a knowledge base by ID. |
| `findAllByCompany(companyId, options)` | Paginated list by company. |
| `update(kbId, dto)` | Update name, description, visibility, etc. |
| `delete(kbId)` | Delete a knowledge base. |

### `RetrieverSearchType`

```ts
import { RetrieverSearchType } from "@flutchai/knowledge";

RetrieverSearchType.Similarity          // cosine similarity (vector search)
RetrieverSearchType.MMR                 // maximal marginal relevance (vector search)
RetrieverSearchType.Search              // full-text search (calls textSearch on the vector store)
RetrieverSearchType.SimilarityWithScore // cosine similarity with score values
```

## Chunking Configuration

Chunking is configured per knowledge base via `settings.splitOptions`:

```ts
{
  enabled: true,
  splitType: SplitType.SIZE,   // SIZE | SEPARATOR | SMART
  chunkSize: 1000,             // tokens per chunk
  chunkOverlap: 200,           // overlap between chunks
  separator: "<!-- CHUNK_SEPARATOR -->",  // custom separator (SEPARATOR mode)
}
```

Default values are exported as `CHUNKING_DEFAULTS`.

## Peer Dependencies

- `@nestjs/common` ^10
- `@nestjs/core` ^10
- `reflect-metadata` ^0.1

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your branch: `git checkout -b feat/my-feature`
3. Build: `yarn build`
4. Submit a pull request

## License

MIT
