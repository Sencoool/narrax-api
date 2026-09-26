import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─── Log helpers ────────────────────────────────────────────────────────────

const SEP = '─'.repeat(64);
const SEP_THIN = '┄'.repeat(64);

function logBlock(logger: Logger, label: string, content: string): void {
  logger.verbose(`${SEP}\n[${label}]\n${SEP_THIN}\n${content}\n${SEP}`);
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);

  private baseUrl!: string;
  private textModel!: string;
  private embeddingModel!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.baseUrl =
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://localhost:11434';
    this.textModel =
      this.configService.get<string>('OLLAMA_MODEL') || 'my-novel-model';
    this.embeddingModel =
      this.configService.get<string>('OLLAMA_EMBEDDING_MODEL') ||
      'nomic-embed-text';

    this.logger.log(`${SEP}`);
    this.logger.log(`🤖 [AI] Ollama AI Service initialized`);
    this.logger.log(`🤖 [AI] Base URL   : ${this.baseUrl}`);
    this.logger.log(`🤖 [AI] Text model : ${this.textModel}`);
    this.logger.log(`🤖 [AI] Embed model: ${this.embeddingModel}`);
    this.logger.log(`${SEP}`);
  }

  /**
   * สร้าง text embeddings สำหรับ RAG vector search
   * ใช้ nomic-embed-text (768 dimensions)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    this.logger.debug(
      `🔢 [AI:embed] model: ${this.embeddingModel} | text: ${text.length} chars`,
    );

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.embeddingModel,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as { embedding: number[] };
      this.logger.debug(
        `🔢 [AI:embed] ✅ ${data.embedding.length} dims returned`,
      );
      return data.embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding with Ollama', error);
      throw error;
    }
  }

  /**
   * Generate ข้อความจาก AI แบบ streaming
   * ส่งคืน AsyncIterable ของ text chunks สำหรับ SSE
   */
  async *generateStream(
    systemPrompt: string,
    userMessage: string,
    options?: {
      temperature?: number;
      maxOutputTokens?: number;
      signal?: AbortSignal;
    },
  ): AsyncIterable<string> {
    const temp = options?.temperature ?? 0.8;
    const maxTokens = options?.maxOutputTokens ?? 4000;

    this.logger.log(`${SEP}`);
    this.logger.log(`🌊 [AI:stream] START`);
    this.logger.log(
      `🌊 [AI:stream] model: ${this.textModel} | temp: ${temp} | maxTokens: ${maxTokens}`,
    );
    this.logger.log(
      `🌊 [AI:stream] systemPrompt: ${systemPrompt.length} chars | userMessage: ${userMessage.length} chars`,
    );
    logBlock(
      this.logger,
      `SYSTEM PROMPT — ${systemPrompt.length} chars`,
      systemPrompt,
    );
    logBlock(
      this.logger,
      `USER MESSAGE — ${userMessage.length} chars`,
      userMessage,
    );

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.textModel,
        system: systemPrompt,
        prompt: userMessage,
        stream: true,
        options: {
          temperature: temp,
          num_predict: maxTokens,
        },
      }),
      signal: options?.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama generate error! status: ${response.status}`);
    }

    this.logger.log(
      `🌊 [AI:stream] Ollama responded HTTP ${response.status} — streaming tokens...`,
    );

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalChars = 0;
    let firstChunkLogged = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // เอาบรรทัดที่ยังไม่สมบูรณ์เก็บไว้ใน buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          try {
            const parsed = JSON.parse(line) as { response?: string };
            if (parsed.response) {
              totalChars += parsed.response.length;
              if (!firstChunkLogged) {
                this.logger.log(`🌊 [AI:stream] first token received ✅`);
                firstChunkLogged = true;
              }
              yield parsed.response;
            }
          } catch {
            this.logger.warn(`Failed to parse Ollama stream chunk: ${line}`);
          }
        }
      }
    } catch (err: unknown) {
      // AbortError is expected when the client disconnects — not a real failure
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.log(
          `🌊 [AI:stream] ABORTED by caller — total output so far: ${totalChars} chars`,
        );
        return;
      }
      throw err;
    } finally {
      reader.releaseLock();
    }

    this.logger.log(`🌊 [AI:stream] DONE — total output: ${totalChars} chars`);
    this.logger.log(`${SEP}`);
  }

  /**
   * Generate ข้อความแบบรอจนเสร็จ (ไม่ streaming)
   */
  async generate(
    systemPrompt: string,
    userMessage: string,
    options?: {
      temperature?: number;
      maxOutputTokens?: number;
    },
  ): Promise<string> {
    const temp = options?.temperature ?? 0.7;
    const maxTokens = options?.maxOutputTokens ?? 2048;

    this.logger.log(`${SEP}`);
    this.logger.log(`🤖 [AI:generate] START`);
    this.logger.log(
      `🤖 [AI:generate] model: ${this.textModel} | temp: ${temp} | maxTokens: ${maxTokens}`,
    );
    this.logger.log(
      `🤖 [AI:generate] systemPrompt: ${systemPrompt.length} chars | userMessage: ${userMessage.length} chars`,
    );
    logBlock(
      this.logger,
      `SYSTEM PROMPT — ${systemPrompt.length} chars`,
      systemPrompt,
    );
    logBlock(
      this.logger,
      `USER MESSAGE — ${userMessage.length} chars`,
      userMessage,
    );
    this.logger.log(`🤖 [AI:generate] calling Ollama... (non-streaming)`);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.textModel,
        system: systemPrompt,
        prompt: userMessage,
        stream: false,
        options: {
          temperature: temp,
          num_predict: maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama generate error! status: ${response.status}`);
    }

    const data = (await response.json()) as { response: string };

    this.logger.log(
      `🤖 [AI:generate] ✅ response received — ${data.response.length} chars`,
    );
    logBlock(
      this.logger,
      `RESPONSE — ${data.response.length} chars`,
      data.response,
    );
    this.logger.log(`${SEP}`);

    return data.response;
  }
}
