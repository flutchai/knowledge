import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { SearchService } from "./search.service";
import { KmsTokens } from "../kms.tokens";
import { RetrieverTokens } from "../../retriever/retriever.tokens";
import { RetrieverSearchType, ArticleSource } from "../../shared/enums";

const mockRetriever = {
  addDocuments: jest.fn(),
  deleteDocuments: jest.fn(),
  updateDocuments: jest.fn(),
  search: jest.fn(),
};

const mockArticleRepo = {
  findById: jest.fn(),
  update: jest.fn(),
};

const mockKbRepo = {
  findById: jest.fn(),
};

const baseArticle = {
  id: "a-1",
  knowledgeBaseId: "kb-1",
  publishedArticle: { title: "Hello World", content: "Some content here." },
};

const baseKb = {
  id: "kb-1",
  settings: { splitOptions: { enabled: false } },
};

describe("SearchService", () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: RetrieverTokens.KNOWLEDGE_RETRIEVER, useValue: mockRetriever },
        { provide: KmsTokens.ARTICLE_REPOSITORY, useValue: mockArticleRepo },
        { provide: KmsTokens.KB_REPOSITORY, useValue: mockKbRepo },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    jest.clearAllMocks();
  });

  describe("indexArticle", () => {
    it("should chunk, embed, and save chunk IDs to the article", async () => {
      mockArticleRepo.findById.mockResolvedValue(baseArticle);
      mockKbRepo.findById.mockResolvedValue(baseKb);
      mockRetriever.addDocuments.mockResolvedValue(["c-1", "c-2"]);
      mockArticleRepo.update.mockResolvedValue({});

      await service.indexArticle("a-1");

      expect(mockRetriever.addDocuments).toHaveBeenCalled();
      expect(mockArticleRepo.update).toHaveBeenCalledWith("a-1", {
        retrieverChunksIds: ["c-1", "c-2"],
      });
    });

    it("should throw NotFoundException if article does not exist", async () => {
      mockArticleRepo.findById.mockResolvedValue(null);

      await expect(service.indexArticle("a-1")).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if article has no content", async () => {
      mockArticleRepo.findById.mockResolvedValue({
        id: "a-1",
        knowledgeBaseId: "kb-1",
        publishedArticle: null,
        draftArticle: null,
      });
      mockKbRepo.findById.mockResolvedValue(baseKb);

      await expect(service.indexArticle("a-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("removeArticleFromIndex", () => {
    it("should delete all chunks from the vector store", async () => {
      mockArticleRepo.findById.mockResolvedValue({
        ...baseArticle,
        retrieverChunksIds: ["c-1", "c-2"],
      });
      mockRetriever.deleteDocuments.mockResolvedValue(undefined);

      await service.removeArticleFromIndex("a-1");

      expect(mockRetriever.deleteDocuments).toHaveBeenCalledWith(["c-1", "c-2"]);
    });

    it("should throw NotFoundException if article has no indexed chunks", async () => {
      mockArticleRepo.findById.mockResolvedValue(baseArticle);

      await expect(service.removeArticleFromIndex("a-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("reindexArticle", () => {
    it("should index from scratch if no previous chunks exist", async () => {
      mockArticleRepo.findById.mockResolvedValue(baseArticle);
      mockKbRepo.findById.mockResolvedValue(baseKb);
      mockRetriever.addDocuments.mockResolvedValue(["c-new"]);
      mockArticleRepo.update.mockResolvedValue({});

      await service.reindexArticle("a-1");

      expect(mockRetriever.addDocuments).toHaveBeenCalled();
    });

    it("should update existing chunks when they exist", async () => {
      const articleWithChunks = { ...baseArticle, retrieverChunksIds: ["c-old"] };
      mockArticleRepo.findById.mockResolvedValue(articleWithChunks);
      mockKbRepo.findById.mockResolvedValue(baseKb);
      mockRetriever.updateDocuments.mockResolvedValue(["c-new"]);
      mockArticleRepo.update.mockResolvedValue({});

      await service.reindexArticle("a-1");

      expect(mockRetriever.updateDocuments).toHaveBeenCalled();
      expect(mockArticleRepo.update).toHaveBeenCalledWith("a-1", {
        retrieverChunksIds: ["c-new"],
      });
    });
  });

  describe("indexArticle – resolveDocType", () => {
    it("should set docType=file for FILE source articles", async () => {
      const fileArticle = {
        id: "a-file",
        knowledgeBaseId: "kb-1",
        source: ArticleSource.FILE,
        publishedArticle: { title: "A file", content: "file body" },
      };
      mockArticleRepo.findById.mockResolvedValue(fileArticle);
      mockKbRepo.findById.mockResolvedValue(baseKb);
      mockRetriever.addDocuments.mockResolvedValue(["c-1"]);
      mockArticleRepo.update.mockResolvedValue({});

      await service.indexArticle("a-file");

      const [docs] = mockRetriever.addDocuments.mock.calls[0];
      expect(docs[0].metadata.docType).toBe("file");
    });

    it("should set docType=email and attach metadata for EMAIL source articles", async () => {
      const emailArticle = {
        id: "a-email",
        knowledgeBaseId: "kb-1",
        source: ArticleSource.EMAIL,
        publishedArticle: { title: "Re: Meeting", content: "See you there." },
        extra: {
          email: {
            subject: "Re: Meeting",
            subjectNormalized: "meeting",
            messageId: "<msg-1@mail.com>",
            inReplyTo: "<msg-0@mail.com>",
            references: ["<msg-0@mail.com>"],
            threadId: "thread-1",
            from: "alice@example.com",
            to: ["bob@example.com"],
            cc: ["carol@example.com"],
            bcc: [],
            participants: ["alice@example.com"],
            participantsHash: "alice@example.com|bob@example.com|carol@example.com",
            dateIso: new Date("2024-01-15T10:00:00Z"),
            dateEpoch: 1705312800000,
            hasAttachments: false,
            attachmentNames: [],
            labels: ["inbox"],
            mailbox: "INBOX",
            entities: {},
            sourceUrl: "https://mail.example.com/msg-1",
          },
        },
      };
      mockArticleRepo.findById.mockResolvedValue(emailArticle);
      mockKbRepo.findById.mockResolvedValue(baseKb);
      mockRetriever.addDocuments.mockResolvedValue(["c-email"]);
      mockArticleRepo.update.mockResolvedValue({});

      await service.indexArticle("a-email");

      const [docs] = mockRetriever.addDocuments.mock.calls[0];
      expect(docs[0].metadata.docType).toBe("email");
      expect(docs[0].metadata.subject).toBe("Re: Meeting");
      expect(docs[0].metadata.from).toBe("alice@example.com");
      expect(docs[0].metadata.participants).toContain("alice@example.com");
      expect(docs[0].metadata.participantsHash).toBeDefined();
    });

    it("should attach minimal email metadata when emailMeta is absent", async () => {
      const emailNoMeta = {
        id: "a-email-no-meta",
        knowledgeBaseId: "kb-1",
        source: ArticleSource.EMAIL,
        publishedArticle: { title: "Subject Fallback", content: "body" },
        extra: {},
      };
      mockArticleRepo.findById.mockResolvedValue(emailNoMeta);
      mockKbRepo.findById.mockResolvedValue(baseKb);
      mockRetriever.addDocuments.mockResolvedValue(["c-1"]);
      mockArticleRepo.update.mockResolvedValue({});

      await service.indexArticle("a-email-no-meta");

      const [docs] = mockRetriever.addDocuments.mock.calls[0];
      expect(docs[0].metadata.docType).toBe("email");
      expect(docs[0].metadata.subjectNormalized).toBeDefined();
    });

    it("should deduplicate participants and compute hash when participantsHash is absent", async () => {
      const emailArticle = {
        id: "a-email-dedup",
        knowledgeBaseId: "kb-1",
        source: ArticleSource.EMAIL,
        publishedArticle: { title: "Dedup Test", content: "body" },
        extra: {
          email: {
            subject: "Dedup Test",
            from: "alice@example.com",
            to: ["BOB@example.com"],
            cc: ["bob@example.com"], // duplicate (different case)
            bcc: [],
            participants: [],
            // no participantsHash — forces computeParticipantsHash
          },
        },
      };
      mockArticleRepo.findById.mockResolvedValue(emailArticle);
      mockKbRepo.findById.mockResolvedValue(baseKb);
      mockRetriever.addDocuments.mockResolvedValue(["c-1"]);
      mockArticleRepo.update.mockResolvedValue({});

      await service.indexArticle("a-email-dedup");

      const [docs] = mockRetriever.addDocuments.mock.calls[0];
      // alice + bob (deduped from BOB and bob) = 2 unique participants
      expect(docs[0].metadata.participants).toHaveLength(2);
      expect(docs[0].metadata.participantsHash).toBeDefined();
    });
  });

  describe("search", () => {
    it("should return results from the retriever", async () => {
      const docs = [{ pageContent: "result", metadata: { knowledgeBaseId: "kb-1" } }];
      mockRetriever.search.mockResolvedValue(docs);

      const result = await service.search("query", RetrieverSearchType.Similarity, "kb-1");

      expect(mockRetriever.search).toHaveBeenCalledWith("query", RetrieverSearchType.Similarity, [
        "kb-1",
      ]);
      expect(result).toEqual(docs);
    });

    it("should throw BadRequestException when kbId is empty", async () => {
      await expect(service.search("query", RetrieverSearchType.Similarity, "")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should return empty array when retriever returns null", async () => {
      mockRetriever.search.mockResolvedValue(null);

      const result = await service.search("query", RetrieverSearchType.Similarity, "kb-1");

      expect(result).toEqual([]);
    });
  });
});
