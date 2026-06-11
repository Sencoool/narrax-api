import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  /**
   * ขนาด chunk: ประมาณ 800 ตัวอักษรไทย (≈ 400 tokens)
   * overlap 100 ตัวอักษรเพื่อไม่ให้ตัดประโยคสำคัญ
   */
  private readonly CHUNK_SIZE = 800;
  private readonly CHUNK_OVERLAP = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * แบ่ง text เป็น chunks โดยพยายามตัดที่ขอบประโยค
   */
  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + this.CHUNK_SIZE;

      if (end < text.length) {
        // หาจุดตัดที่เหมาะสม: ขึ้นบรรทัดใหม่ หรือจุดสิ้นสุดประโยค
        const newlineIdx = text.lastIndexOf('\n', end);
        const periodIdx = text.lastIndexOf('。', end); // จุดญี่ปุ่น/ไทย
        const thaiEndIdx = text.lastIndexOf(' ', end);

        const cutAt = Math.max(newlineIdx, periodIdx, thaiEndIdx);
        if (cutAt > start + this.CHUNK_SIZE / 2) {
          end = cutAt + 1;
        }
      }

      chunks.push(text.slice(start, end).trim());
      start = end - this.CHUNK_OVERLAP;
    }

    return chunks.filter((c) => c.length > 0);
  }

  /**
   * แบ่ง episode เป็น chunks แล้วสร้าง embeddings เก็บใน DB
   * เรียกเมื่อ episode ถูกสร้างหรืออัปเดต
   */
  async chunkAndEmbed(episodeId: string): Promise<void> {
    const episode = await this.prisma.episode.findUniqueOrThrow({
      where: { id: episodeId },
      select: { id: true, novelId: true, title: true, content: true },
    });

    // ลบ chunks เก่าออกก่อน
    await this.prisma.episodeChunk.deleteMany({
      where: { episodeId },
    });

    const chunks = this.splitIntoChunks(episode.content);
    this.logger.log(
      `Episode "${episode.title}": split into ${chunks.length} chunks`,
    );

    // สร้าง embedding ทีละ chunk (Gemini rate limit aware)
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = `[ตอน: ${episode.title}]\n${chunks[i]}`;
      const embedding = await this.aiService.generateEmbedding(chunkText);

      // บันทึกลง DB ด้วย raw SQL เพราะ Prisma ยังไม่รองรับ vector type โดยตรง
      await this.prisma.$executeRaw`
        INSERT INTO "EpisodeChunk" (id, "episodeId", "novelId", "chunkIndex", content, embedding, "createdAt")
        VALUES (
          gen_random_uuid(),
          ${episodeId}::uuid,
          ${episode.novelId}::uuid,
          ${i},
          ${chunkText},
          ${`[${embedding.join(',')}]`}::vector(768),
          NOW()
        )
        ON CONFLICT DO NOTHING
      `;
    }

    this.logger.log(
      `Episode "${episode.title}": ${chunks.length} chunks embedded successfully`,
    );
  }

  /**
   * ค้นหา chunks ที่เกี่ยวข้องที่สุดกับ query ใน novel นั้น
   * ใช้ cosine similarity จาก pgvector
   */
  async retrieveRelevantChunks(
    novelId: string,
    query: string,
    topK = 5,
  ): Promise<string[]> {
    const queryEmbedding = await this.aiService.generateEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results = await this.prisma.$queryRaw<{ content: string }[]>`
      SELECT content
      FROM "EpisodeChunk"
      WHERE "novelId" = ${novelId}::uuid
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector(768)
      LIMIT ${topK}
    `;

    return results.map((r) => r.content);
  }

  /**
   * สร้าง context string สำหรับ AI System Prompt
   * รวม NovelContext (ตัวละคร, โลก, โครงเรื่อง) + relevant chunks
   */
  async buildContext(novelId: string, userQuery: string): Promise<string> {
    const [novelContext, relevantChunks] = await Promise.all([
      this.prisma.novelContext.findUnique({ where: { novelId } }),
      this.retrieveRelevantChunks(novelId, userQuery),
    ]);

    const contextParts: string[] = [];

    if (novelContext) {
      if (novelContext.characters) {
        contextParts.push(`## ตัวละครหลัก\n${novelContext.characters}`);
      }
      if (novelContext.worldBuilding) {
        contextParts.push(
          `## ฉากและโลกในเรื่อง\n${novelContext.worldBuilding}`,
        );
      }
      if (novelContext.plotOutline) {
        contextParts.push(`## โครงเรื่องหลัก\n${novelContext.plotOutline}`);
      }
      if (novelContext.writingStyle) {
        contextParts.push(`## สไตล์การเขียน\n${novelContext.writingStyle}`);
      }
    }

    if (relevantChunks.length > 0) {
      contextParts.push(
        `## เนื้อเรื่องที่เกี่ยวข้อง\n${relevantChunks.join('\n\n---\n\n')}`,
      );
    }

    return contextParts.join('\n\n');
  }
}
