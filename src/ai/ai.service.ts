import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);

  private baseUrl: string;
  private textModel: string;
  private embeddingModel: string;

  constructor(private readonly configService: ConfigService) { }

  onModuleInit() {
    this.baseUrl =
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://localhost:11434';
    this.textModel =
      this.configService.get<string>('OLLAMA_MODEL') || 'hf.co/mradermacher/llama-3-typhoon-v1.5-8b-instruct-GGUF:Q4_K_M';
    this.embeddingModel =
      this.configService.get<string>('OLLAMA_EMBEDDING_MODEL') ||
      'nomic-embed-text';

    this.logger.log(
      `Ollama AI Service initialized. Models -> Text: ${this.textModel}, Embedding: ${this.embeddingModel}`,
    );
  }

  /**
   * สร้าง text embeddings สำหรับ RAG vector search
   * ใช้ nomic-embed-text (768 dimensions)
   */
  async generateEmbedding(text: string): Promise<number[]> {
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
    },
  ): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.textModel,
        system: systemPrompt,
        prompt: userMessage,
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.8,
          num_predict: options?.maxOutputTokens ?? 4000,
        },
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama generate error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
              yield parsed.response;
            }
          } catch {
            this.logger.warn(`Failed to parse Ollama stream chunk: ${line}`);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
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
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.textModel,
        system: systemPrompt,
        prompt: userMessage,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxOutputTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama generate error! status: ${response.status}`);
    }

    const data = (await response.json()) as { response: string };
    return data.response;
  }
}
