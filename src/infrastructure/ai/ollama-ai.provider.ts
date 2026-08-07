import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IAiProvider, GenerateOptions } from '../../application/ports/ai-provider.port.js';

// ─── Log helpers ─────────────────────────────────────────────────────────────

const SEP = '─'.repeat(64);
const SEP_THIN = '┄'.repeat(64);

function logBlock(logger: Logger, label: string, content: string): void {
  logger.verbose(`${SEP}\n[${label}]\n${SEP_THIN}\n${content}\n${SEP}`);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ollama implementation of the IAiProvider port.
 *
 * This class replaces the previous AiService for all application-layer use.
 * The existing AiService is kept for backward compatibility during the Phase 3→4
 * migration and will be removed in Phase 6.
 */
@Injectable()
export class OllamaAiProvider implements IAiProvider, OnModuleInit {
  private readonly logger = new Logger(OllamaAiProvider.name);

  private baseUrl!: string;
  private textModel!: string;
  private embeddingModel!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.baseUrl =
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://localhost:11434';
    this.textModel =
      this.configService.get<string>('OLLAMA_MODEL') || 'my-novel-model';
    this.embeddingModel =
      this.configService.get<string>('OLLAMA_EMBEDDING_MODEL') ||
      'nomic-embed-text';

    this.logger.log(`${SEP}`);
    this.logger.log(`🤖 [OllamaAiProvider] initialized`);
    this.logger.log(`🤖 [OllamaAiProvider] Base URL   : ${this.baseUrl}`);
    this.logger.log(`🤖 [OllamaAiProvider] Text model : ${this.textModel}`);
    this.logger.log(`🤖 [OllamaAiProvider] Embed model: ${this.embeddingModel}`);
    this.logger.log(`${SEP}`);
  }

  // ─── IAiProvider ──────────────────────────────────────────────────────────

  async generate(
    systemPrompt: string,
    userMessage: string,
    options?: GenerateOptions,
  ): Promise<string> {
    const temp = options?.temperature ?? 0.7;
    const maxTokens = options?.maxOutputTokens ?? 2048;

    this.logger.log(`${SEP}`);
    this.logger.log(`🤖 [AI:generate] model: ${this.textModel} | temp: ${temp} | maxTokens: ${maxTokens}`);
    this.logger.log(`🤖 [AI:generate] systemPrompt: ${systemPrompt.length} chars | userMessage: ${userMessage.length} chars`);
    logBlock(this.logger, `SYSTEM PROMPT — ${systemPrompt.length} chars`, systemPrompt);
    logBlock(this.logger, `USER MESSAGE — ${userMessage.length} chars`, userMessage);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.textModel,
        system: systemPrompt,
        prompt: userMessage,
        stream: false,
        options: { temperature: temp, num_predict: maxTokens },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama generate error! status: ${response.status}`);
    }

    const data = (await response.json()) as { response: string };
    this.logger.log(`🤖 [AI:generate] ✅ ${data.response.length} chars received`);
    logBlock(this.logger, `RESPONSE — ${data.response.length} chars`, data.response);
    this.logger.log(`${SEP}`);

    return data.response;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    this.logger.debug(
      `🔢 [AI:embed] model: ${this.embeddingModel} | text: ${text.length} chars`,
    );

    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.embeddingModel, prompt: text }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embeddings error! status: ${response.status}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    this.logger.debug(`🔢 [AI:embed] ✅ ${data.embedding.length} dims returned`);

    return data.embedding;
  }

  async *stream(
    systemPrompt: string,
    userMessage: string,
    options?: GenerateOptions & { signal?: AbortSignal },
  ): AsyncIterable<string> {
    const temp = options?.temperature ?? 0.8;
    const maxTokens = options?.maxOutputTokens ?? 4000;

    this.logger.log(`${SEP}`);
    this.logger.log(`🌊 [AI:stream] START | model: ${this.textModel} | temp: ${temp} | maxTokens: ${maxTokens}`);
    logBlock(this.logger, `SYSTEM PROMPT — ${systemPrompt.length} chars`, systemPrompt);
    logBlock(this.logger, `USER MESSAGE — ${userMessage.length} chars`, userMessage);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.textModel,
        system: systemPrompt,
        prompt: userMessage,
        stream: true,
        options: { temperature: temp, num_predict: maxTokens },
      }),
      signal: (options as { signal?: AbortSignal } | undefined)?.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama stream error! status: ${response.status}`);
    }

    this.logger.log(`🌊 [AI:stream] HTTP ${response.status} — streaming...`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalChars = 0;
    let firstChunk = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as { response?: string };
            if (parsed.response) {
              totalChars += parsed.response.length;
              if (!firstChunk) {
                this.logger.log(`🌊 [AI:stream] first token ✅`);
                firstChunk = true;
              }
              yield parsed.response;
            }
          } catch {
            this.logger.warn(`Failed to parse stream chunk: ${line}`);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.log(`🌊 [AI:stream] ABORTED — ${totalChars} chars so far`);
        return;
      }
      throw err;
    } finally {
      reader.releaseLock();
    }

    this.logger.log(`🌊 [AI:stream] DONE — ${totalChars} chars total`);
    this.logger.log(`${SEP}`);
  }
}
