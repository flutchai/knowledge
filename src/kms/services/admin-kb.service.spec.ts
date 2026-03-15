import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { AdminKnowledgeBaseService } from "./admin-kb.service";
import { KmsTokens } from "../kms.tokens";
import { CreateKnowledgeBaseDto } from "../dto/create-knowledge-base.dto";
import {
  KnowledgeBaseContentType,
  KnowledgeBaseOwnership,
  VisibilityLevel,
  KnowledgeBaseStatus,
} from "../../shared/enums";
import { CHUNKING_DEFAULTS } from "../../shared/types";

const mockKbRepository = {
  findById: jest.fn(),
  findByCompany: jest.fn(),
  findByOwner: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const baseKb = {
  id: "kb-1",
  name: "Test KB",
  ownerId: "owner-1",
  ownership: KnowledgeBaseOwnership.PERSONAL,
  visibility: VisibilityLevel.PRIVATE,
  visibilityStatus: KnowledgeBaseStatus.DRAFT,
  contentType: KnowledgeBaseContentType.GENERAL,
  settings: {
    allowComments: false,
    allowTags: true,
    requireModeration: false,
    maxArticleSize: 100000,
    moderatorIds: [],
    splitOptions: { enabled: true, splitType: "size" },
  },
};

describe("AdminKnowledgeBaseService", () => {
  let service: AdminKnowledgeBaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminKnowledgeBaseService,
        { provide: KmsTokens.KB_REPOSITORY, useValue: mockKbRepository },
      ],
    }).compile();

    service = module.get<AdminKnowledgeBaseService>(AdminKnowledgeBaseService);
    jest.clearAllMocks();
  });

  describe("findById", () => {
    it("should return knowledge base when found", async () => {
      mockKbRepository.findById.mockResolvedValue(baseKb);

      const result = await service.findById("kb-1");

      expect(result).toEqual(baseKb);
      expect(mockKbRepository.findById).toHaveBeenCalledWith("kb-1");
    });

    it("should throw NotFoundException when not found", async () => {
      mockKbRepository.findById.mockResolvedValue(null);

      await expect(service.findById("kb-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("should create knowledge base with default settings", async () => {
      const dto = {
        name: "New KB",
        ownerId: "owner-1",
        ownership: KnowledgeBaseOwnership.PERSONAL,
        visibility: VisibilityLevel.PRIVATE,
        contentType: KnowledgeBaseContentType.GENERAL,
      };
      mockKbRepository.create.mockResolvedValue({ id: "kb-2", ...dto });

      const result = await service.create(dto as CreateKnowledgeBaseDto);

      expect(result.id).toBe("kb-2");
      expect(mockKbRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            splitOptions: expect.objectContaining({
              enabled: true,
              chunkSize: CHUNKING_DEFAULTS.CHUNK_SIZE,
              chunkOverlap: CHUNKING_DEFAULTS.CHUNK_OVERLAP,
            }),
          }),
        }),
      );
    });

    it("should set visibility to PUBLIC for LINK_IN_BIO content type", async () => {
      const dto = {
        name: "Link KB",
        ownerId: "owner-1",
        ownership: KnowledgeBaseOwnership.PERSONAL,
        visibility: VisibilityLevel.PRIVATE,
        contentType: KnowledgeBaseContentType.LINK_IN_BIO,
      };
      mockKbRepository.create.mockResolvedValue({ id: "kb-3", ...dto });

      await service.create(dto as CreateKnowledgeBaseDto);

      expect(mockKbRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: VisibilityLevel.PUBLIC }),
      );
    });
  });

  describe("update", () => {
    it("should update and return the knowledge base", async () => {
      const updated = { ...baseKb, name: "Updated KB" };
      mockKbRepository.findById.mockResolvedValue(baseKb);
      mockKbRepository.update.mockResolvedValue(updated);

      const result = await service.update("kb-1", { name: "Updated KB" });

      expect(result.name).toBe("Updated KB");
    });

    it("should throw NotFoundException if knowledge base does not exist", async () => {
      mockKbRepository.findById.mockResolvedValue(null);

      await expect(service.update("kb-1", { name: "x" })).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if update returns null", async () => {
      mockKbRepository.findById.mockResolvedValue(baseKb);
      mockKbRepository.update.mockResolvedValue(null);

      await expect(service.update("kb-1", { name: "x" })).rejects.toThrow(BadRequestException);
    });
  });

  describe("delete", () => {
    it("should delete knowledge base when it exists", async () => {
      mockKbRepository.findById.mockResolvedValue(baseKb);
      mockKbRepository.delete.mockResolvedValue(undefined);

      await service.delete("kb-1");

      expect(mockKbRepository.delete).toHaveBeenCalledWith("kb-1");
    });

    it("should throw NotFoundException when knowledge base does not exist", async () => {
      mockKbRepository.findById.mockResolvedValue(null);

      await expect(service.delete("kb-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAllByCompany", () => {
    it("should return paginated results", async () => {
      const paginated = { items: [baseKb], total: 1, page: 1, limit: 20 };
      mockKbRepository.findByCompany.mockResolvedValue(paginated);

      const result = await service.findAllByCompany("company-1", { page: 1, limit: 20 });

      expect(result).toEqual(paginated);
      expect(mockKbRepository.findByCompany).toHaveBeenCalledWith("company-1", {
        page: 1,
        limit: 20,
      });
    });
  });
});
