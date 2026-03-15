import { IsString, IsOptional, IsEnum } from "class-validator";
import { VisibilityLevel, KnowledgeBaseStatus } from "../../shared/enums";
import { IKBSettings } from "../../shared/types";

export class UpdateKnowledgeBaseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(VisibilityLevel)
  visibility?: VisibilityLevel;

  @IsOptional()
  @IsEnum(KnowledgeBaseStatus)
  visibilityStatus?: KnowledgeBaseStatus;

  @IsOptional()
  settings?: Partial<IKBSettings>;
}
