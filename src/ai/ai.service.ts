import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
} from '@google/generative-ai';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;
  private textModel: GenerativeModel;
  private embeddingModel: GenerativeModel;

  // Models
  private readonly TEXT_MODEL = 'gemini-2.0-flash';
  private readonly EMBEDDING_MODEL = 'text-embedding-004';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.textModel = this.genAI.getGenerativeModel({ model: this.TEXT_MODEL });
    this.embeddingModel = this.genAI.getGenerativeModel({
      model: this.EMBEDDING_MODEL,
    });
    this.logger.log(`AI Service initialized with model: ${this.TEXT_MODEL}`);
  }

  /**
   * สร้าง text embeddings สำหรับ RAG vector search
   * ใช้ text-embedding-004 ของ Gemini (768 dimensions)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.embeddingModel.embedContent(text);

    if (!response.embedding?.values) {
      throw new Error('Failed to generate embedding: no values returned');
    }

    return response.embedding.values;
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
    // สร้าง model instance พร้อม system instruction และ generation config
    const model = this.genAI.getGenerativeModel({
      model: this.TEXT_MODEL,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: options?.temperature ?? 0.8,
        maxOutputTokens: options?.maxOutputTokens ?? 2048,
      },
    });

    const result = await model.generateContentStream(userMessage);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }

  /**
   * Generate ข้อความแบบรอจนเสร็จ (ไม่ streaming)
   * ใช้สำหรับ auto-extract context หรืองานที่ไม่ต้องการ real-time
   */
  async generate(
    systemPrompt: string,
    userMessage: string,
    options?: {
      temperature?: number;
      maxOutputTokens?: number;
    },
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: this.TEXT_MODEL,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxOutputTokens ?? 2048,
      },
    });

    const result = await model.generateContent(userMessage);
    return result.response.text();
  }
}
