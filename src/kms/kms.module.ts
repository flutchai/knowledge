import { DynamicModule, Module, Provider, Type } from "@nestjs/common";
import { KmsTokens } from "./kms.tokens";
import { AdminKnowledgeBaseService } from "./services/admin-kb.service";
import { SearchService } from "./services/search.service";
import { IKnowledgeBaseRepository } from "./interfaces/kb-repository.interface";
import { IArticleRepository } from "./interfaces/article-repository.interface";
import { RetrieverModule, RetrieverModuleOptions } from "../retriever/retriever.module";

export interface KmsModuleOptions {
  retriever: RetrieverModuleOptions;

  /** Your implementations of the repository interfaces. */
  repositories: {
    knowledgeBase: new (...args: any[]) => IKnowledgeBaseRepository;
    article: new (...args: any[]) => IArticleRepository;
  };

  /**
   * Extra NestJS modules to import into KmsModule context.
   * Use this to pass TypeOrmModule.forFeature([...]) so that
   * repository classes have access to their TypeORM providers.
   */
  extraImports?: any[];
}

@Module({})
export class KmsModule {
  static forRoot(options: KmsModuleOptions): DynamicModule {
    const kbRepositoryProvider: Provider = {
      provide: KmsTokens.KB_REPOSITORY,
      useClass: options.repositories.knowledgeBase,
    };

    const articleRepositoryProvider: Provider = {
      provide: KmsTokens.ARTICLE_REPOSITORY,
      useClass: options.repositories.article,
    };

    return {
      module: KmsModule,
      imports: [RetrieverModule.forRoot(options.retriever), ...(options.extraImports ?? [])],
      providers: [
        kbRepositoryProvider,
        articleRepositoryProvider,
        AdminKnowledgeBaseService,
        SearchService,
        {
          provide: KmsTokens.ADMIN_KB_SERVICE,
          useClass: AdminKnowledgeBaseService,
        },
        {
          provide: KmsTokens.SEARCH_SERVICE,
          useClass: SearchService,
        },
      ],
      exports: [
        KmsTokens.ADMIN_KB_SERVICE,
        KmsTokens.SEARCH_SERVICE,
        AdminKnowledgeBaseService,
        SearchService,
        RetrieverModule,
      ],
    };
  }
}
