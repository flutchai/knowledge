import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DocumentInterface } from "@langchain/core/documents";
import { RetrieverSearchType, ArticleSource, SplitType } from "../../shared/enums";
import {
  ISplitOptions,
  IArticle,
  IArticleEmailMetadata,
  CHUNKING_DEFAULTS,
} from "../../shared/types";
import { RetrieverTokens } from "../../retriever/retriever.tokens";
import { IKnowledgeRetrieverService } from "../../retriever/interfaces/retriever.interface";
import { CustomDocumentMetadata, RetrieveQueryOptions } from "../../retriever/types";
import { IKnowledgeBaseRepository } from "../interfaces/kb-repository.interface";
import { IArticleRepository } from "../interfaces/article-repository.interface";
import { KmsTokens } from "../kms.tokens";

// Email helpers (moved out of monolith)
function normalizeSubject(subject?: string | null): string {
  if (!subject) return "";
  return subject
    .trim()
    .toLowerCase()
    .replace(/^(re|fw|fwd):\s*/g, "")
    .replace(/\[(.*?)\]/g, " ")
    .replace(/<([^>]+)>/g, " ")
    .replace(/\(([^)]+)\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeParticipants(participants: string[]): string[] {
  const seen = new Set<string>();
  return participants.filter((p) => {
    if (!p?.trim()) return false;
    const n = p.trim().toLowerCase();
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

function computeParticipantsHash(participants: string[]): string {
  return participants
    .map((p) => p?.trim()?.toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(RetrieverTokens.KNOWLEDGE_RETRIEVER)
    private readonly retrieverService: IKnowledgeRetrieverService,
    @Inject(KmsTokens.ARTICLE_REPOSITORY)
    private readonly articleRepo: IArticleRepository,
    @Inject(KmsTokens.KB_REPOSITORY)
    private readonly kbRepo: IKnowledgeBaseRepository,
  ) {}

  async search(
    query: string,
    searchType: RetrieverSearchType,
    kbId: string,
    _options?: RetrieveQueryOptions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- LangChain DocumentInterface metadata type
  ): Promise<DocumentInterface<Record<string, any>>[]> {
    if (!kbId) throw new BadRequestException("Knowledge Base ID is required");
    return (await this.retrieverService.search(query, searchType, [kbId])) || [];
  }

  /** Call this when an article is published to vectorize it. */
  async indexArticle(articleId: string): Promise<void> {
    const article = await this.articleRepo.findById(articleId);
    if (!article) throw new NotFoundException("Article not found");

    const chunkIds = await this.createChunks(article);
    await this.articleRepo.update(articleId, { retrieverChunksIds: chunkIds });
    this.logger.log(`Article ${articleId} indexed with ${chunkIds.length} chunks`);
  }

  /** Call this when an article is unpublished to remove it from the index. */
  async removeArticleFromIndex(articleId: string): Promise<void> {
    const article = await this.articleRepo.findById(articleId);
    if (!article?.retrieverChunksIds) {
      throw new NotFoundException("Article chunks not found in index");
    }
    await this.retrieverService.deleteDocuments(article.retrieverChunksIds);
  }

  /** Call this when an article content changes and needs re-indexing. */
  async reindexArticle(articleId: string): Promise<void> {
    const article = await this.articleRepo.findById(articleId);
    if (!article) throw new NotFoundException("Article not found");

    if (!article.retrieverChunksIds) {
      await this.indexArticle(articleId);
      return;
    }

    const document = this.toDocument(article);
    const splitOptions = await this.getSplitOptions(article);

    const newIds = await this.retrieverService.updateDocuments(
      [document],
      article.retrieverChunksIds,
      article.knowledgeBaseId,
      splitOptions,
    );

    await this.articleRepo.update(articleId, { retrieverChunksIds: newIds });
    this.logger.log(`Article ${articleId} re-indexed`);
  }

  private async createChunks(article: IArticle): Promise<string[]> {
    const document = this.toDocument(article);
    const splitOptions = await this.getSplitOptions(article);
    return this.retrieverService.addDocuments([document], article.knowledgeBaseId, splitOptions);
  }

  private toDocument(article: IArticle): DocumentInterface<CustomDocumentMetadata> {
    const content = article.publishedArticle ?? article.draftArticle;
    if (!content) {
      throw new BadRequestException("Article has no content to index");
    }

    const title = content.title?.trim() ?? "";
    const body = content.content?.trim() ?? "";
    const pageContent = [title, body].filter(Boolean).join("\n");

    const metadata: CustomDocumentMetadata = {
      docType: this.resolveDocType(article.source),
      knowledgeBaseId: article.knowledgeBaseId,
      articleId: article.id,
      title: title || undefined,
      author: content.author,
      sourceTitle: content.sourceTitle,
      sourceUrl: content.sourceUrl,
      images: content.images,
      tags: content.tags,
    };

    if (article.source === ArticleSource.EMAIL) {
      this.attachEmailMetadata(metadata, article.extra?.email, title);
    }

    return { pageContent: pageContent || title || body, metadata };
  }

  private resolveDocType(source?: ArticleSource): CustomDocumentMetadata["docType"] {
    switch (source) {
      case ArticleSource.FILE:
        return "file";
      case ArticleSource.EMAIL:
        return "email";
      default:
        return "article";
    }
  }

  private attachEmailMetadata(
    metadata: CustomDocumentMetadata,
    emailMeta: IArticleEmailMetadata | undefined,
    fallbackSubject: string,
  ): void {
    if (!emailMeta) {
      metadata.subject = fallbackSubject || metadata.subject;
      metadata.subjectNormalized = normalizeSubject(metadata.subject);
      return;
    }

    metadata.subject = emailMeta.subject || fallbackSubject || metadata.subject;
    metadata.subjectNormalized = emailMeta.subjectNormalized || normalizeSubject(metadata.subject);
    metadata.messageId = emailMeta.messageId;
    metadata.inReplyTo = emailMeta.inReplyTo;
    metadata.references = emailMeta.references;
    metadata.threadId = emailMeta.threadId;
    metadata.from = emailMeta.from;
    metadata.to = emailMeta.to;
    metadata.cc = emailMeta.cc;
    metadata.bcc = emailMeta.bcc;

    const aggregated = dedupeParticipants([
      ...(emailMeta.participants ?? []),
      emailMeta.from || "",
      ...((emailMeta.to as string[]) ?? []),
      ...((emailMeta.cc as string[]) ?? []),
      ...((emailMeta.bcc as string[]) ?? []),
    ]);

    if (aggregated.length) {
      metadata.participants = aggregated;
      metadata.participantsHash = emailMeta.participantsHash || computeParticipantsHash(aggregated);
    }

    metadata.dateIso = emailMeta.dateIso;
    metadata.dateEpoch = emailMeta.dateEpoch ?? emailMeta.dateIso?.getTime() ?? undefined;
    metadata.hasAttachments = emailMeta.hasAttachments;
    metadata.attachmentNames = emailMeta.attachmentNames;
    metadata.labels = emailMeta.labels;
    metadata.mailbox = emailMeta.mailbox;
    metadata.entities = emailMeta.entities;
    if (emailMeta.sourceUrl && !metadata.sourceUrl) {
      metadata.sourceUrl = emailMeta.sourceUrl;
    }
  }

  private async getSplitOptions(article: IArticle): Promise<ISplitOptions> {
    const kb = await this.kbRepo.findById(article.knowledgeBaseId);
    if (!kb) throw new NotFoundException("Knowledge base not found");

    const s = kb.settings?.splitOptions;
    return {
      enabled: s?.enabled || false,
      splitType: s?.splitType || SplitType.SIZE,
      chunkSize: s?.chunkSize && s.chunkSize > 0 ? s.chunkSize : CHUNKING_DEFAULTS.CHUNK_SIZE,
      chunkOverlap:
        s?.chunkOverlap && s.chunkOverlap >= 0 ? s.chunkOverlap : CHUNKING_DEFAULTS.CHUNK_OVERLAP,
      separator: s?.separator || CHUNKING_DEFAULTS.SEPARATOR,
    };
  }
}
