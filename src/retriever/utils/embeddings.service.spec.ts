import { OpenAIEmbeddings } from "@langchain/openai";
import { EmbeddingsService } from "./embeddings.service";

describe("EmbeddingsService", () => {
  describe("createEmbeddings", () => {
    it("should return the pre-configured embeddings instance when provided", () => {
      const mockEmbeddings = { embedQuery: jest.fn() } as unknown as OpenAIEmbeddings;
      const service = new EmbeddingsService({ embeddings: mockEmbeddings });

      expect(service.createEmbeddings()).toBe(mockEmbeddings);
    });

    it("should create OpenAIEmbeddings with the provided API key", () => {
      const service = new EmbeddingsService({ openAiApiKey: "sk-test" });

      const result = service.createEmbeddings();

      expect(result).toBeInstanceOf(OpenAIEmbeddings);
    });

    it("should use the default model text-embedding-ada-002 when not specified", () => {
      const service = new EmbeddingsService({ openAiApiKey: "sk-test" });
      const result = service.createEmbeddings() as OpenAIEmbeddings & { model: string };

      expect(result.model).toBe("text-embedding-ada-002");
    });

    it("should use a custom model when specified", () => {
      const service = new EmbeddingsService({
        openAiApiKey: "sk-test",
        model: "text-embedding-3-small",
      });
      const result = service.createEmbeddings() as OpenAIEmbeddings & { model: string };

      expect(result.model).toBe("text-embedding-3-small");
    });

    it("should fall back to OPENAI_API_KEY env var when no key provided", () => {
      process.env.OPENAI_API_KEY = "sk-env-key";
      const service = new EmbeddingsService({});

      const result = service.createEmbeddings();

      expect(result).toBeInstanceOf(OpenAIEmbeddings);
      delete process.env.OPENAI_API_KEY;
    });

    it("should create OpenAIEmbeddings with default config when constructed with no args", () => {
      process.env.OPENAI_API_KEY = "sk-no-args-key";
      const service = new EmbeddingsService();

      const result = service.createEmbeddings();

      expect(result).toBeInstanceOf(OpenAIEmbeddings);
      delete process.env.OPENAI_API_KEY;
    });
  });
});
