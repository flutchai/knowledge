import { DocumentUtilsService } from "./document-utils.service";
import { SplitType } from "../../shared/enums";

describe("DocumentUtilsService", () => {
  let service: DocumentUtilsService;

  beforeEach(() => {
    service = new DocumentUtilsService();
  });

  describe("cleanRAGMeta (static)", () => {
    it("should remove RAG meta comments from content", () => {
      const input = "Hello <!-- RAG_META: some meta data --> World";
      expect(DocumentUtilsService.cleanRAGMeta(input)).toBe("Hello  World");
    });

    it("should handle multiline RAG meta", () => {
      const input = "Before\n<!-- RAG_META:\nline1\nline2\n-->After";
      expect(DocumentUtilsService.cleanRAGMeta(input)).toBe("Before\nAfter");
    });

    it("should return content unchanged when no RAG meta present", () => {
      const input = "Plain content without any meta.";
      expect(DocumentUtilsService.cleanRAGMeta(input)).toBe(input);
    });
  });

  describe("cleanNoIndex (static)", () => {
    it("should remove NO_INDEX sections", () => {
      const input = "Keep this <!-- NO_INDEX -->Remove this<!-- /NO_INDEX --> and this";
      expect(DocumentUtilsService.cleanNoIndex(input)).toBe("Keep this  and this");
    });

    it("should return content unchanged when no NO_INDEX present", () => {
      const input = "Normal content";
      expect(DocumentUtilsService.cleanNoIndex(input)).toBe(input);
    });
  });

  describe("formatDocumentsAsString", () => {
    it("should return fallback message for empty array", () => {
      expect(service.formatDocumentsAsString([])).toBe("No relevant documents found");
    });

    it("should format documents with index and content", () => {
      const docs = [
        {
          pageContent: "content 1",
          metadata: {
            knowledgeBaseId: "kb-1",
            articleId: "a-1",
            docType: "article" as const,
            sourceTitle: "Source 1",
          },
        },
      ];
      const result = service.formatDocumentsAsString(docs);
      expect(result).toContain("Document 1");
      expect(result).toContain("content 1");
    });
  });

  describe("createCitationAttachment", () => {
    it("should create a citation attachment from document metadata", () => {
      const doc = {
        pageContent: "content",
        metadata: {
          knowledgeBaseId: "kb-1",
          articleId: "a-1",
          docType: "article" as const,
          title: "My Article",
          sourceTitle: "Source",
          sourceUrl: "https://example.com/article",
        },
      };
      const attachment = service.createCitationAttachment(doc);

      expect(attachment.type).toBe("citation");
      const source = (attachment.value as { source: Record<string, unknown> }).source;
      expect(source.url).toBe("https://example.com/article");
      expect(source.articleId).toBe("a-1");
    });

    it("should detect PDF type from URL", () => {
      const doc = {
        pageContent: "content",
        metadata: {
          knowledgeBaseId: "kb-1",
          articleId: "a-1",
          docType: "file" as const,
          sourceUrl: "https://example.com/doc.pdf",
        },
      };
      const attachment = service.createCitationAttachment(doc);
      const source = (attachment.value as { source: Record<string, unknown> }).source;
      expect(source.type).toBe("pdf");
    });

    it("should throw if document has no metadata", () => {
      expect(() => service.createCitationAttachment({ pageContent: "x" } as never)).toThrow();
    });
  });

  describe("splitDocsToChunks", () => {
    it("should split document by separator", async () => {
      const docs = [
        {
          pageContent: "Part one<!-- CHUNK_SEPARATOR -->Part two<!-- CHUNK_SEPARATOR -->Part three",
          metadata: { articleId: "a-1", knowledgeBaseId: "kb-1" },
        },
      ];
      const chunks = await service.splitDocsToChunks(docs, {
        enabled: true,
        splitType: SplitType.SEPARATOR,
        separator: "<!-- CHUNK_SEPARATOR -->",
      });

      expect(chunks.length).toBe(3);
      expect(chunks[0].pageContent).toBe("Part one");
      expect(chunks[1].pageContent).toBe("Part two");
    });

    it("should return original doc as single chunk when splitting is disabled", async () => {
      const docs = [
        { pageContent: "Short text", metadata: { articleId: "a-1", knowledgeBaseId: "kb-1" } },
      ];
      const chunks = await service.splitDocsToChunks(docs, {
        enabled: false,
        splitType: SplitType.SIZE,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
