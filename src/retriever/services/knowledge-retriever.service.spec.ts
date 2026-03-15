import { Test, TestingModule } from "@nestjs/testing";
import { KnowledgeRetrieverService } from "./knowledge-retriever.service";
import { RetrieverTokens } from "../retriever.tokens";
import { DocumentUtilsService } from "../utils/document-utils.service";
import { RetrieverSearchType, SplitType } from "../../shared/enums";

const mockVectorStore = {
  addDocuments: jest.fn(),
  delete: jest.fn(),
  vectorSearch: jest.fn(),
  textSearch: jest.fn(),
  getChunkById: jest.fn(),
  getChunksForDocument: jest.fn(),
};

const mockDocumentUtils = {
  splitDocsToChunks: jest.fn(),
};

const makeDoc = (content = "text", kbId = "kb-1") => ({
  pageContent: content,
  metadata: { knowledgeBaseId: kbId },
});

describe("KnowledgeRetrieverService", () => {
  let service: KnowledgeRetrieverService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeRetrieverService,
        { provide: RetrieverTokens.PERSISTENCE_VECTOR_STORE, useValue: mockVectorStore },
        { provide: DocumentUtilsService, useValue: mockDocumentUtils },
      ],
    }).compile();

    service = module.get<KnowledgeRetrieverService>(KnowledgeRetrieverService);
    jest.clearAllMocks();
  });

  describe("addDocuments", () => {
    it("should add documents and return chunk ids", async () => {
      mockVectorStore.addDocuments.mockResolvedValue(["id-1", "id-2"]);
      const docs = [makeDoc()];

      const result = await service.addDocuments(docs, "kb-1");

      expect(mockVectorStore.addDocuments).toHaveBeenCalled();
      expect(result).toEqual(["id-1", "id-2"]);
    });

    it("should not split when splitOptions is disabled", async () => {
      mockVectorStore.addDocuments.mockResolvedValue(["id-1"]);

      await service.addDocuments([makeDoc()], "kb-1", {
        enabled: false,
        splitType: SplitType.SIZE,
      });

      expect(mockDocumentUtils.splitDocsToChunks).not.toHaveBeenCalled();
    });

    it("should split documents when splitOptions is enabled", async () => {
      const splitDocs = [makeDoc("chunk-1"), makeDoc("chunk-2")];
      mockDocumentUtils.splitDocsToChunks.mockResolvedValue(splitDocs);
      mockVectorStore.addDocuments.mockResolvedValue(["id-1", "id-2"]);

      const result = await service.addDocuments([makeDoc("long text")], "kb-1", {
        enabled: true,
        splitType: SplitType.SIZE,
      });

      expect(mockDocumentUtils.splitDocsToChunks).toHaveBeenCalled();
      expect(result).toEqual(["id-1", "id-2"]);
    });

    it("should inject knowledgeBaseId and createdAt into metadata", async () => {
      mockVectorStore.addDocuments.mockResolvedValue(["id-1"]);
      const docs = [{ pageContent: "hello", metadata: { existingField: "x" } }];

      await service.addDocuments(docs, "kb-99");

      const calledDocs = mockVectorStore.addDocuments.mock.calls[0][0];
      expect(calledDocs[0].metadata.knowledgeBaseId).toBe("kb-99");
      expect(calledDocs[0].metadata.createdAt).toBeDefined();
      expect(calledDocs[0].metadata.existingField).toBe("x");
    });
  });

  describe("deleteDocuments", () => {
    it("should delete documents by ids", async () => {
      mockVectorStore.delete.mockResolvedValue(undefined);

      await service.deleteDocuments(["id-1", "id-2"]);

      expect(mockVectorStore.delete).toHaveBeenCalledWith({ ids: ["id-1", "id-2"] });
    });
  });

  describe("updateDocuments", () => {
    it("should delete old chunks and insert new ones", async () => {
      mockVectorStore.delete.mockResolvedValue(undefined);
      mockVectorStore.addDocuments.mockResolvedValue(["new-id"]);

      const result = await service.updateDocuments([makeDoc()] as never[], ["old-id"], "kb-1");

      expect(mockVectorStore.delete).toHaveBeenCalledWith({ ids: ["old-id"] });
      expect(result).toEqual(["new-id"]);
    });

    it("should continue adding documents even if delete throws", async () => {
      mockVectorStore.delete.mockRejectedValue(new Error("delete failed"));
      mockVectorStore.addDocuments.mockResolvedValue(["new-id"]);

      const result = await service.updateDocuments([makeDoc()] as never[], ["old-id"], "kb-1");

      expect(result).toEqual(["new-id"]);
    });
  });

  describe("search", () => {
    it("should call vectorSearch for Similarity type and return filtered results", async () => {
      mockVectorStore.vectorSearch.mockResolvedValue([
        makeDoc("result", "kb-1"),
        makeDoc("noise", "kb-other"),
      ]);

      const result = await service.search("query", RetrieverSearchType.Similarity, ["kb-1"]);

      expect(mockVectorStore.vectorSearch).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].metadata.knowledgeBaseId).toBe("kb-1");
    });

    it("should call vectorSearch for MMR type", async () => {
      mockVectorStore.vectorSearch.mockResolvedValue([makeDoc("r", "kb-1")]);

      await service.search("query", RetrieverSearchType.MMR, ["kb-1"]);

      expect(mockVectorStore.vectorSearch).toHaveBeenCalled();
      expect(mockVectorStore.textSearch).not.toHaveBeenCalled();
    });

    it("should call textSearch for Search type", async () => {
      mockVectorStore.textSearch.mockResolvedValue([makeDoc("r", "kb-1")]);

      await service.search("query", RetrieverSearchType.Search, ["kb-1"]);

      expect(mockVectorStore.textSearch).toHaveBeenCalled();
      expect(mockVectorStore.vectorSearch).not.toHaveBeenCalled();
    });

    it("should return empty array for SimilarityWithScore type (unhandled)", async () => {
      const result = await service.search("query", RetrieverSearchType.SimilarityWithScore, [
        "kb-1",
      ]);

      expect(result).toEqual([]);
    });

    it("should handle null result from vectorStore", async () => {
      mockVectorStore.vectorSearch.mockResolvedValue(null);

      const result = await service.search("query", RetrieverSearchType.Similarity, ["kb-1"]);

      expect(result).toEqual([]);
    });

    it("should clean RAG meta from document content", async () => {
      mockVectorStore.vectorSearch.mockResolvedValue([
        {
          pageContent: "clean <!-- RAG_META: meta --> text",
          metadata: { knowledgeBaseId: "kb-1" },
        },
      ]);

      const result = await service.search("query", RetrieverSearchType.Similarity, ["kb-1"]);

      expect(result[0].pageContent).toBe("clean  text");
    });
  });

  describe("getChunkById", () => {
    it("should delegate to vectorStore", async () => {
      mockVectorStore.getChunkById.mockResolvedValue({ id: "c-1" });

      const result = await service.getChunkById("c-1");

      expect(result).toEqual({ id: "c-1" });
    });
  });

  describe("getChunksForDocument", () => {
    it("should delegate to vectorStore", async () => {
      mockVectorStore.getChunksForDocument.mockResolvedValue([{ id: "c-1" }, { id: "c-2" }]);

      const result = await service.getChunksForDocument("article-1");

      expect(result).toHaveLength(2);
    });
  });
});
