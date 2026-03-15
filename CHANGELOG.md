# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-15

### Added
- `KmsModule.forRoot()` — dynamic NestJS module with repository injection
- `RetrieverModule.forRoot()` — standalone vector retrieval module
- `SearchService` — article indexing, reindexing, removal, and semantic search
- `AdminKnowledgeBaseService` — knowledge base CRUD with default chunking settings
- `PostgresVectorStore` — pgvector backend (PostgreSQL 16+)
- `MongoVectorStore` — MongoDB Atlas Vector Search backend
- `EmbeddingsService` — OpenAI `text-embedding-ada-002` embeddings
- `DocumentUtilsService` — text chunking (SIZE, SEPARATOR, SMART strategies)
- `IKnowledgeBaseRepository` / `IArticleRepository` — repository interfaces for BYO storage
- Full TypeScript types and enums exported from package root
