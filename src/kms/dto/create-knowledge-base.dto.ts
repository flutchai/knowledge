import { IsString, IsOptional, IsEnum } from "class-validator";
import {
  KnowledgeBaseOwnership,
  KnowledgeBaseContentType,
  VisibilityLevel,
} from "../../shared/enums";
import { IKBSettings } from "../../shared/types";

export class CreateKnowledgeBaseDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsEnum(KnowledgeBaseOwnership)
  ownership: KnowledgeBaseOwnership;

  @IsEnum(VisibilityLevel)
  visibility: VisibilityLevel;

  @IsOptional()
  @IsEnum(KnowledgeBaseContentType)
  contentType?: KnowledgeBaseContentType;

  @IsOptional()
  settings?: Partial<IKBSettings>;
}
