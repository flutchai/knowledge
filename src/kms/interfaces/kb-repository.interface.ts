import {
  IKnowledgeBase,
  ICreateKnowledgeBase,
  IUpdateKnowledgeBase,
  PaginationOptions,
  PaginatedResult,
} from "../../shared/types";

export interface IKnowledgeBaseRepository {
  findById(id: string): Promise<IKnowledgeBase | null>;
  findByCompany(
    companyId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IKnowledgeBase>>;
  findByOwner(
    ownerId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IKnowledgeBase>>;
  create(data: ICreateKnowledgeBase): Promise<IKnowledgeBase>;
  update(id: string, data: IUpdateKnowledgeBase): Promise<IKnowledgeBase | null>;
  delete(id: string): Promise<void>;
}
