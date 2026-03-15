import {
  IArticle,
  ICreateArticle,
  IUpdateArticle,
  PaginationOptions,
  PaginatedResult,
} from "../../shared/types";

export interface IArticleRepository {
  findById(id: string): Promise<IArticle | null>;
  findByKnowledgeBase(kbId: string, options: PaginationOptions): Promise<PaginatedResult<IArticle>>;
  create(data: ICreateArticle): Promise<IArticle>;
  update(id: string, data: IUpdateArticle): Promise<IArticle | null>;
  delete(id: string): Promise<void>;
}
