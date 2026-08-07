/**
 * Options for a text generation call.
 * Maps directly to what AiService.generate() accepts today.
 */
export interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Port (interface) for AI text generation and embedding.
 *
 * The concrete implementation (OllamaAiProvider) lives in the infrastructure
 * layer and wraps the current AiService logic.
 *
 * Defining this interface here lets use-cases depend on an abstraction —
 * making them testable without a running Ollama instance.
 */
export interface IAiProvider {
  /**
   * Generates a text completion given a system prompt and user message.
   * Returns the full generated text as a string.
   */
  generate(
    systemPrompt: string,
    userMessage: string,
    options?: GenerateOptions,
  ): Promise<string>;

  /**
   * Generates a dense vector embedding for the given text.
   * The number of dimensions depends on the configured embedding model
   * (currently nomic-embed-text → 768 dims).
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Streams a text completion, yielding chunks as they arrive.
   * Used by the story-generation-stream controller.
   */
  stream(
    systemPrompt: string,
    userMessage: string,
    options?: GenerateOptions,
  ): AsyncIterable<string>;
}

/** NestJS DI injection token for IAiProvider. */
export const AI_PROVIDER = Symbol('IAiProvider');
