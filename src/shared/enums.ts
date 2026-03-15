// Inlined from @amelie/shared-types and @amelie/shared-models

export enum RetrieverSearchType {
  Search = "search",
  MMR = "mmr",
  Similarity = "similarity",
  SimilarityWithScore = "similarity_with_score",
}

export enum SplitType {
  SIZE = "size",
  SEPARATOR = "separator",
  SMART = "smart",
}

export enum AttachmentType {
  IMAGE = "image",
  VOICE = "voice",
  VIDEO = "video",
  FILE = "file",
  CITATION = "citation",
  SUGGESTION = "suggestion",
  CARD = "card",
  CHART = "chart",
  BUTTON = "button",
  ORDER_LINK = "order_link",
  WEBAPP = "webapp",
}

export enum KnowledgeBaseStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
  MAINTENANCE = "maintenance",
}

export enum KnowledgeBaseOwnership {
  PERSONAL = "personal",
  COMPANY = "company",
}

export enum KnowledgeBaseContentType {
  GENERAL = "general",
  LANDING_PAGES = "landing_pages",
  LINK_IN_BIO = "link_in_bio",
  BLOG = "blog",
  DOCUMENTATION = "documentation",
  INGREDIENTS_CATALOG = "ingredients_catalog",
  RECIPES = "recipes",
}

export enum VisibilityLevel {
  PUBLIC = "public",
  PRIVATE = "private",
  COMPANY = "company",
}

export enum ArticleSource {
  MANUAL = "manual",
  FILE = "file",
  EMAIL = "email",
  IMPORT = "import",
}
