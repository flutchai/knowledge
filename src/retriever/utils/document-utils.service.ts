import { Injectable, Logger } from "@nestjs/common";
import {
  TokenTextSplitter,
  RecursiveCharacterTextSplitter,
} from "@langchain/textsplitters";
import { DocumentInterface } from "@langchain/core/documents";
import { CustomDocument } from "../types";
import {
  ISplitOptions,
  IAttachment,
  CHUNKING_DEFAULTS,
  DEFAULT_SEPARATORS,
  TEXT_PROCESSING_VALIDATION,
} from "../../shared/types";
import { SplitType, AttachmentType } from "../../shared/enums";

@Injectable()
export class DocumentUtilsService {
  private readonly logger = new Logger(DocumentUtilsService.name);

  async splitDocsToChunks(
    docs: DocumentInterface<Record<string, any>>[],
    splitOptions?: ISplitOptions,
    defaultChunkSize: number = CHUNKING_DEFAULTS.CHUNK_SIZE,
    defaultChunkOverlap: number = CHUNKING_DEFAULTS.CHUNK_OVERLAP
  ): Promise<DocumentInterface<Record<string, any>>[]> {
    const originalDocCount = docs.length;
    const splitter = this.createTextSplitter(
      splitOptions,
      defaultChunkSize,
      defaultChunkOverlap
    );
    let chunks = await splitter.transformDocuments(docs);
    chunks = this.addChunkMetadata(chunks, docs);
    this.logger.debug(
      `Split ${originalDocCount} documents into ${chunks.length} chunks`
    );
    return chunks;
  }

  private addChunkMetadata(
    chunks: DocumentInterface<Record<string, any>>[],
    originalDocs: DocumentInterface<Record<string, any>>[]
  ): DocumentInterface<Record<string, any>>[] {
    const docChunksMap = new Map<
      string,
      DocumentInterface<Record<string, any>>[]
    >();

    chunks.forEach(chunk => {
      const docId =
        chunk.metadata.articleId || chunk.metadata.docId || "unknown";
      if (!docChunksMap.has(docId)) docChunksMap.set(docId, []);
      docChunksMap.get(docId)!.push(chunk);
    });

    const enhancedChunks: DocumentInterface<Record<string, any>>[] = [];

    docChunksMap.forEach((docChunks, docId) => {
      const totalChunks = docChunks.length;
      const originalDoc = originalDocs.find(
        d => (d.metadata.articleId || d.metadata.docId || "unknown") === docId
      );

      docChunks.forEach((chunk, index) => {
        enhancedChunks.push({
          ...chunk,
          metadata: {
            ...chunk.metadata,
            chunkIndex: index,
            totalChunks,
            chunkLength: chunk.pageContent.length,
            documentLength: originalDoc?.pageContent?.length || null,
            ...(originalDoc &&
              this.calculateChunkPosition(chunk, originalDoc, index)),
          },
        });
      });
    });

    return enhancedChunks;
  }

  private calculateChunkPosition(
    chunk: DocumentInterface<Record<string, any>>,
    originalDoc: DocumentInterface<Record<string, any>>,
    chunkIndex: number
  ): { startPosition?: number; endPosition?: number } {
    try {
      const chunkContent = chunk.pageContent;
      const originalContent = originalDoc.pageContent;
      if (!chunkContent || !originalContent) return {};

      const startPosition = originalContent.indexOf(chunkContent);
      if (startPosition !== -1) {
        return { startPosition, endPosition: startPosition + chunkContent.length };
      }

      const avgChunkSize = originalContent.length / (chunkIndex + 1);
      const estimatedStart = Math.floor(chunkIndex * avgChunkSize);
      return {
        startPosition: estimatedStart,
        endPosition: Math.min(
          estimatedStart + chunkContent.length,
          originalContent.length
        ),
      };
    } catch (error) {
      this.logger.warn(
        `Failed to calculate chunk position: ${error instanceof Error ? error.message : String(error)}`
      );
      return {};
    }
  }

  private createTextSplitter(
    splitOptions?: ISplitOptions,
    defaultChunkSize: number = CHUNKING_DEFAULTS.CHUNK_SIZE,
    defaultChunkOverlap: number = CHUNKING_DEFAULTS.CHUNK_OVERLAP
  ) {
    if (!splitOptions || !splitOptions.enabled) {
      return new TokenTextSplitter({
        chunkSize: defaultChunkSize,
        chunkOverlap: defaultChunkOverlap,
      });
    }

    let chunkSize =
      splitOptions.chunkSize !== undefined
        ? splitOptions.chunkSize
        : defaultChunkSize;
    let chunkOverlap =
      splitOptions.chunkOverlap !== undefined
        ? splitOptions.chunkOverlap
        : defaultChunkOverlap;

    if (chunkSize < TEXT_PROCESSING_VALIDATION.MIN_CHUNK_SIZE) {
      this.logger.warn(
        `chunkSize ${chunkSize} too small, using minimum ${TEXT_PROCESSING_VALIDATION.MIN_CHUNK_SIZE}`
      );
      chunkSize = TEXT_PROCESSING_VALIDATION.MIN_CHUNK_SIZE;
    }

    if (chunkOverlap >= chunkSize) {
      this.logger.warn(
        `chunkOverlap ${chunkOverlap} >= chunkSize ${chunkSize}, adjusting`
      );
      chunkOverlap = Math.floor(
        chunkSize * CHUNKING_DEFAULTS.CHUNK_OVERLAP_RATIO
      );
    }

    switch (splitOptions.splitType) {
      case SplitType.SEPARATOR: {
        const self = this;
        return {
          async transformDocuments(
            docs: DocumentInterface[]
          ): Promise<DocumentInterface[]> {
            let separator =
              splitOptions.separator || CHUNKING_DEFAULTS.SEPARATOR;
            separator = self.sanitizeSeparator(separator);
            const result: DocumentInterface[] = [];
            for (const doc of docs) {
              const parts = doc.pageContent.split(separator);
              parts.forEach(part => {
                if (part.trim()) {
                  result.push({ pageContent: part.trim(), metadata: { ...doc.metadata } });
                }
              });
            }
            return result;
          },
        };
      }

      case SplitType.SMART:
        return new RecursiveCharacterTextSplitter({
          separators: splitOptions.separators || [...DEFAULT_SEPARATORS],
          chunkSize,
          chunkOverlap,
        });

      case SplitType.SIZE:
      default:
        return new TokenTextSplitter({ chunkSize, chunkOverlap });
    }
  }

  formatDocumentsAsString(docs: CustomDocument[]): string {
    if (docs.length === 0) return "No relevant documents found";
    return docs
      .map(
        (doc, index) => `
        ---
        Document ${index + 1}: ${doc.metadata.sourceTitle}
        ${doc.pageContent}
        ----
      `
      )
      .join("\n\n");
  }

  createCitationAttachment(customDoc: CustomDocument): IAttachment {
    if (!customDoc.metadata) {
      throw new Error("Document has no metadata");
    }
    const { sourceTitle, title, articleId, knowledgeBaseId, sourceUrl } =
      customDoc.metadata;

    return {
      type: AttachmentType.CITATION,
      value: {
        source: {
          url: sourceUrl || "",
          title: sourceTitle || title || "Source",
          type: sourceUrl?.toLowerCase().endsWith(".pdf") ? "pdf" : "webpage",
          ...(articleId && { articleId }),
          ...(knowledgeBaseId && { knowledgeBaseId }),
        },
      },
      metadata: {},
    };
  }

  formatChunksAndAttachments(docs: CustomDocument[]): {
    text: string;
    attachments: IAttachment[];
  } {
    if (!docs.length) return { text: "No relevant documents found", attachments: [] };

    const groups = new Map<
      string,
      { title: string; chunks: string[]; doc: CustomDocument }
    >();

    docs.forEach(doc => {
      const key =
        doc.metadata.articleId ||
        doc.metadata.sourceUrl ||
        doc.metadata.sourceTitle ||
        "";
      if (!groups.has(key)) {
        groups.set(key, {
          title: doc.metadata.sourceTitle || doc.metadata.title || "Source",
          chunks: [doc.pageContent],
          doc,
        });
      } else {
        groups.get(key)!.chunks.push(doc.pageContent);
      }
    });

    const textParts: string[] = [];
    const attachments: IAttachment[] = [];

    Array.from(groups.values()).forEach((group, index) => {
      textParts.push(`
        ---
        Document ${index + 1}: ${group.title}
        ${group.chunks.join("\n")}
        ----
      `);
      try {
        attachments.push(this.createCitationAttachment(group.doc));
      } catch (e) {
        this.logger.error(`Failed to create attachment: ${(e as Error).message}`);
      }
    });

    return { text: textParts.join("\n"), attachments };
  }

  static cleanRAGMeta(content: string): string {
    return content.replace(/<!--\s*RAG_META:[\s\S]*?-->/g, "");
  }

  static cleanNoIndex(content: string): string {
    return content.replace(
      /<!--\s*NO_INDEX\s*-->[\s\S]*?<!--\s*\/NO_INDEX\s*-->/g,
      ""
    );
  }

  private sanitizeSeparator(separator: string): string {
    const trimmed = separator.trim();
    if (!trimmed) {
      this.logger.warn("Empty separator, using default");
      return CHUNKING_DEFAULTS.SEPARATOR;
    }
    if (trimmed.length < TEXT_PROCESSING_VALIDATION.MIN_SEPARATOR_LENGTH) {
      this.logger.warn("Separator too short, using default");
      return CHUNKING_DEFAULTS.SEPARATOR;
    }
    if (!TEXT_PROCESSING_VALIDATION.SEPARATOR_PATTERN.test(trimmed)) {
      this.logger.warn("Invalid separator contains control characters, using default");
      return CHUNKING_DEFAULTS.SEPARATOR;
    }
    return trimmed.slice(0, TEXT_PROCESSING_VALIDATION.MAX_SEPARATOR_LENGTH);
  }
}
