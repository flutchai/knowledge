import { Test, TestingModule } from "@nestjs/testing";
import { TempRetrieverService } from "./temp-retriever.service";
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

describe("TempRetrieverService", () => {
  let service: TempRetrieverService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TempRetrieverService,
        { provide: RetrieverTokens.TEMP_VECTOR_STORE, useValue: mockVectorStore },
        { provide: DocumentUtilsService, useValue: mockDocumentUtils },
      ],
    }).compile();

    service = module.get<TempRetrieverService>(TempRetrieverService);
    jest.clearAllMocks();
  });

  describe("addDocuments", () => {
    it("should add documents without splitting when disabled", async () => {
      const docs = [{ pageContent: "content", metadata: {} }];
      mockVectorStore.addDocuments.mockResolvedValue(["t-1"]);

      const result = await service.addDocuments(docs, {
        enabled: false,
        splitType: SplitType.SIZE,
      });

      expect(mockDocumentUtils.splitDocsToChunks).not.toHaveBeenCalled();
      expect(result).toEqual(["t-1"]);
    });

    it("should split documents when enabled", async () => {
      const docs = [{ pageContent: "long content", metadata: {} }];
      const split = [{ pageContent: "part", metadata: {} }];
      mockDocumentUtils.splitDocsToChunks.mockResolvedValue(split);
      mockVectorStore.addDocuments.mockResolvedValue(["t-1"]);

      await service.addDocuments(docs, { enabled: true, splitType: SplitType.SIZE });

      expect(mockDocumentUtils.splitDocsToChunks).toHaveBeenCalledWith(docs, {
        enabled: true,
        splitType: SplitType.SIZE,
      });
    });

    it("should pass ids to vectorStore when provided", async () => {
      mockVectorStore.addDocuments.mockResolvedValue(["custom-id"]);

      await service.addDocuments([{ pageContent: "x", metadata: {} }], undefined, ["custom-id"]);

      expect(mockVectorStore.addDocuments).toHaveBeenCalledWith(expect.anything(), {
        ids: ["custom-id"],
      });
    });
  });

  describe("deleteDocuments", () => {
    it("should delete by ids", async () => {
      mockVectorStore.delete.mockResolvedValue(undefined);

      await service.deleteDocuments(["t-1", "t-2"]);

      expect(mockVectorStore.delete).toHaveBeenCalledWith({ ids: ["t-1", "t-2"] });
    });
  });

  describe("updateDocuments", () => {
    it("should delete old docs then add new ones with same ids", async () => {
      const docs = [{ pageContent: "updated", metadata: {} }];
      mockVectorStore.delete.mockResolvedValue(undefined);
      mockVectorStore.addDocuments.mockResolvedValue(undefined);

      await service.updateDocuments(docs, ["old-id"]);

      expect(mockVectorStore.delete).toHaveBeenCalledWith({ ids: ["old-id"] });
      expect(mockVectorStore.addDocuments).toHaveBeenCalledWith(docs, { ids: ["old-id"] });
    });
  });

  describe("search", () => {
    it("should call vectorSearch for Similarity", async () => {
      const docs = [{ pageContent: "result", metadata: {} }];
      mockVectorStore.vectorSearch.mockResolvedValue(docs);

      const result = await service.search("query", RetrieverSearchType.Similarity);

      expect(mockVectorStore.vectorSearch).toHaveBeenCalled();
      expect(result).toEqual(docs);
    });

    it("should call vectorSearch for MMR", async () => {
      mockVectorStore.vectorSearch.mockResolvedValue([]);

      await service.search("query", RetrieverSearchType.MMR);

      expect(mockVectorStore.vectorSearch).toHaveBeenCalled();
      expect(mockVectorStore.textSearch).not.toHaveBeenCalled();
    });

    it("should call textSearch for Search type", async () => {
      mockVectorStore.textSearch.mockResolvedValue([]);

      await service.search("query", RetrieverSearchType.Search);

      expect(mockVectorStore.textSearch).toHaveBeenCalled();
      expect(mockVectorStore.vectorSearch).not.toHaveBeenCalled();
    });

    it("should return null for unhandled search type", async () => {
      const result = await service.search("query", RetrieverSearchType.SimilarityWithScore);

      expect(result).toBeNull();
    });

    it("should pass options to vectorStore", async () => {
      mockVectorStore.vectorSearch.mockResolvedValue([]);
      const options = { limit: 5 };

      await service.search("query", RetrieverSearchType.Similarity, options);

      expect(mockVectorStore.vectorSearch).toHaveBeenCalledWith(
        "query",
        RetrieverSearchType.Similarity,
        options,
      );
    });
  });
});
