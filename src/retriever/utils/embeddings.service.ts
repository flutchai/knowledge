import { Injectable } from "@nestjs/common";
import { Embeddings } from "@langchain/core/embeddings";
import { OpenAIEmbeddings } from "@langchain/openai";

export interface EmbeddingsConfig {
  /** Pass a pre-configured Embeddings instance (any LangChain-compatible). */
  embeddings?: Embeddings;
  /** OpenAI API key — used only when no custom embeddings instance provided. */
  openAiApiKey?: string;
  /** Model name. Defaults to text-embedding-ada-002. */
  model?: string;
}

@Injectable()
export class EmbeddingsService {
  constructor(private readonly config: EmbeddingsConfig = {}) {}

  createEmbeddings(): Embeddings {
    if (this.config.embeddings) {
      return this.config.embeddings;
    }

    return new OpenAIEmbeddings({
      model: this.config.model ?? "text-embedding-ada-002",
      apiKey: this.config.openAiApiKey ?? process.env.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 3,
    });
  }
}
