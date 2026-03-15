import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  IKnowledgeBase,
  PaginatedResult,
  PaginationOptions,
  CHUNKING_DEFAULTS,
} from "../../shared/types";
import {
  KnowledgeBaseContentType,
  VisibilityLevel,
  SplitType,
} from "../../shared/enums";
import { CreateKnowledgeBaseDto } from "../dto/create-knowledge-base.dto";
import { UpdateKnowledgeBaseDto } from "../dto/update-knowledge-base.dto";
import { IKnowledgeBaseRepository } from "../interfaces/kb-repository.interface";
import { KmsTokens } from "../kms.tokens";

@Injectable()
export class AdminKnowledgeBaseService {
  private readonly logger = new Logger(AdminKnowledgeBaseService.name);

  constructor(
    @Inject(KmsTokens.KB_REPOSITORY)
    private readonly kbRepository: IKnowledgeBaseRepository
  ) {}

  async findAllByCompany(
    companyId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<IKnowledgeBase>> {
    return this.kbRepository.findByCompany(companyId, options);
  }

  async findById(kbId: string): Promise<IKnowledgeBase> {
    const kb = await this.kbRepository.findById(kbId);
    if (!kb) throw new NotFoundException("Knowledge base not found");
    return kb;
  }

  async create(dto: CreateKnowledgeBaseDto): Promise<IKnowledgeBase> {
    const contentType = dto.contentType ?? KnowledgeBaseContentType.GENERAL;

    const defaultSettings = {
      allowComments: false,
      allowTags: true,
      requireModeration: false,
      maxArticleSize: 100000,
      moderatorIds: [],
      splitOptions: {
        enabled: true,
        splitType: SplitType.SIZE,
        chunkSize: CHUNKING_DEFAULTS.CHUNK_SIZE,
        chunkOverlap: CHUNKING_DEFAULTS.CHUNK_OVERLAP,
      },
    };

    const settings = dto.settings
      ? { ...defaultSettings, ...dto.settings }
      : defaultSettings;

    // Link-in-Bio defaults
    const visibility =
      contentType === KnowledgeBaseContentType.LINK_IN_BIO
        ? VisibilityLevel.PUBLIC
        : dto.visibility;

    return this.kbRepository.create({
      name: dto.name,
      description: dto.description,
      ownerId: dto.ownerId ?? "",
      companyId: dto.companyId,
      ownership: dto.ownership,
      visibility,
      visibilityStatus: "draft" as any,
      contentType,
      settings,
    });
  }

  async update(
    kbId: string,
    dto: UpdateKnowledgeBaseDto
  ): Promise<IKnowledgeBase> {
    const existing = await this.kbRepository.findById(kbId);
    if (!existing) throw new NotFoundException("Knowledge base not found");

    const updated = await this.kbRepository.update(kbId, dto);
    if (!updated) throw new BadRequestException("Failed to update knowledge base");
    return updated;
  }

  async delete(kbId: string): Promise<void> {
    const existing = await this.kbRepository.findById(kbId);
    if (!existing) throw new NotFoundException("Knowledge base not found");
    await this.kbRepository.delete(kbId);
    this.logger.log(`Knowledge base ${kbId} deleted`);
  }
}
