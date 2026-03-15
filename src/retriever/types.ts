import { DocumentInterface } from "@langchain/core/documents";

export interface RetrieveQueryOptions {
  limit?: number;
  filter?: any;
  fetchK?: number;
  lambda?: number;
  scoreThreshold?: number;
}

export interface CustomDocumentMetadata extends Record<string, any> {
  docType?: "article" | "email" | "file" | string;
  sourceType?: "article" | "email" | "file" | string;
  articleId?: string;
  title?: string;
  author?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  images?: string[];
  tags?: string[];
  // Email-specific
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  threadId?: string;
  subject?: string;
  subjectNormalized?: string;
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
  entities?: { companies?: string[]; persons?: string[] };
  // Scores
  relevance_score?: number;
  score?: number;
  source?: string;
  knowledgeBaseId: string | null;
}

export type CustomDocument = DocumentInterface<CustomDocumentMetadata>;
