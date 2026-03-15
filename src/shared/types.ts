// Inlined from @amelie/shared-types

import {
  AttachmentType,
  SplitType,
  KnowledgeBaseOwnership,
  KnowledgeBaseStatus,
  KnowledgeBaseContentType,
  VisibilityLevel,
  ArticleSource,
} from "./enums";

// ─── Chunking ────────────────────────────────────────────────────────────────

export const CHUNKING_DEFAULTS = {
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 200,
  SEPARATOR: "<!-- CHUNK_SEPARATOR -->",
  MIN_CHUNK_SIZE: 100,
  MAX_CHUNK_SIZE: 5000,
  MIN_SEPARATOR_LENGTH: 5,
  MAX_SEPARATOR_LENGTH: 100,
  CHUNK_OVERLAP_RATIO: 0.2,
} as const;

export const DEFAULT_SEPARATORS = ["<!-- CHUNK_SEPARATOR -->", "\n\n", "\n", " "] as const;

export const TEXT_PROCESSING_VALIDATION = {
  SEPARATOR_PATTERN: /^[^\x00-\x1F\x7F]*$/,
  MIN_CHUNK_SIZE: 100,
  MAX_CHUNK_SIZE: 5000,
  MIN_SEPARATOR_LENGTH: 5,
  MAX_SEPARATOR_LENGTH: 100,
} as const;

// ─── Split options ────────────────────────────────────────────────────────────

export interface ISplitOptions {
  enabled: boolean;
  splitType: SplitType;
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
  separators?: string[];
}

// ─── Attachments ─────────────────────────────────────────────────────────────

export type CitationValue = {
  source: {
    url: string;
    title: string;
    type: "webpage" | "pdf" | "article";
    articleId?: string;
    knowledgeBaseId?: string;
  };
};

export type AttachmentValue = CitationValue | string | Record<string, unknown>;

export interface IAttachment {
  type: AttachmentType;
  value: AttachmentValue;
  metadata?: Record<string, unknown>;
}

// ─── Knowledge base ───────────────────────────────────────────────────────────

export interface IBaseEntity {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISplitOptionsSettings {
  enabled: boolean;
  splitType: SplitType;
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
  separators?: string[];
}

export interface IKBBaseSettings {
  allowComments: boolean;
  allowTags: boolean;
  requireModeration: boolean;
  maxArticleSize: number;
  moderatorIds: string[];
  splitOptions: ISplitOptionsSettings;
  typeSpecificSettings?: Record<string, unknown>;
}

export type IKBSettings = IKBBaseSettings;

export interface IKBStats {
  articleCount: number;
  tagCount: number;
  categoryCount: number;
  viewCount: number;
}

export interface IKnowledgeBase extends IBaseEntity {
  name: string;
  description?: string;
  slug?: string;
  ownerId: string;
  avatarUrl?: string;
  ownership: KnowledgeBaseOwnership;
  companyId?: string;
  visibility: VisibilityLevel;
  visibilityStatus: KnowledgeBaseStatus;
  contentType: KnowledgeBaseContentType;
  settings: IKBSettings;
  stats?: IKBStats;
}

export type ICreateKnowledgeBase = Omit<
  IKnowledgeBase,
  "id" | "createdAt" | "updatedAt" | "stats" | "settings" | "ownerId"
> & {
  settings?: Partial<IKBSettings>;
  ownerId?: string;
};

export type IUpdateKnowledgeBase = Partial<
  Omit<ICreateKnowledgeBase, "ownerId" | "ownership" | "companyId">
>;

// ─── Article ──────────────────────────────────────────────────────────────────

export interface IArticleContent {
  title?: string;
  content?: string;
  author?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  images?: string[];
  tags?: string[];
}

export interface IArticleEmailMetadata {
  subject?: string;
  subjectNormalized?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  threadId?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  participants?: string[];
  participantsHash?: string;
  dateIso?: Date;
  dateEpoch?: number;
  hasAttachments?: boolean;
  attachmentNames?: string[];
  labels?: string[];
  mailbox?: string;
  sourceUrl?: string;
  entities?: { companies?: string[]; persons?: string[] };
}

export interface IArticleExtra {
  email?: IArticleEmailMetadata;
}

export interface IArticle extends IBaseEntity {
  knowledgeBaseId: string;
  ownerId?: string;
  source?: ArticleSource;
  draftArticle?: IArticleContent;
  publishedArticle?: IArticleContent;
  retrieverChunksIds?: string[];
  extra?: IArticleExtra;
  isPublished?: boolean;
}

export type ICreateArticle = Omit<
  IArticle,
  "id" | "createdAt" | "updatedAt" | "retrieverChunksIds" | "isPublished"
>;

export type IUpdateArticle = Partial<
  Omit<IArticle, "id" | "createdAt" | "updatedAt" | "knowledgeBaseId">
>;

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
