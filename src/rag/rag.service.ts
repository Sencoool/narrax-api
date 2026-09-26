import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Log helpers ────────────────────────────────────────────────────────────

const SEP = '─'.repeat(64);

function preview(text: string, maxChars = 120): string {
  const flat = text.replace(/\n/g, ' ').trim();
  return flat.length > maxChars ? `${flat.slice(0, maxChars)}…` : flat;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  /**
   * ขนาด chunk: ประมาณ 800 ตัวอักษรไทย (≈ 400 tokens)
   * overlap 100 ตัวอักษรเพื่อไม่ให้ตัดประโยคสำคัญ
   */
  private readonly CHUNK_SIZE = 800;
  private readonly CHUNK_OVERLAP = 100;
  /** Chunks with cosine distance above this value are excluded as semantically irrelevant */
  private readonly COSINE_DISTANCE_THRESHOLD = 0.8;

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

    this.logger.log(`${SEP}`);
    this.logger.log(`📥 [RAG:embed] START — episode: "${episode.title}"`);
    this.logger.log(`📥 [RAG:embed] episodeId: ${episodeId}`);
    this.logger.log(
      `📥 [RAG:embed] content length: ${episode.content.length} chars`,
    );

    // ลบ chunks เก่าออกก่อน
    const deleted = await this.prisma.episodeChunk.deleteMany({
      where: { episodeId },
    });
    this.logger.log(`🗑️  [RAG:embed] deleted ${deleted.count} old chunk(s)`);

    const chunks = this.splitIntoChunks(episode.content);
    this.logger.log(
      `✂️  [RAG:embed] split into ${chunks.length} chunk(s) (CHUNK_SIZE=${this.CHUNK_SIZE}, OVERLAP=${this.CHUNK_OVERLAP})`,
    );

    // แสดง preview ของแต่ละ chunk
    chunks.forEach((c, i) => {
      this.logger.verbose(`  chunk[${i}] (${c.length} chars): "${preview(c)}"`);
    });

    // สร้าง embedding ทีละ chunk (Gemini rate limit aware)
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = `[ตอน: ${episode.title}]\n${chunks[i]}`;
      this.logger.log(
        `🔢 [RAG:embed] generating embedding for chunk[${i}/${chunks.length - 1}]...`,
      );

      const embedding = await this.aiService.generateEmbedding(chunkText);
      this.logger.log(
        `🔢 [RAG:embed] chunk[${i}] → embedding OK (${embedding.length} dims)`,
      );

      // บันทึกลง DB ด้วย raw SQL เพราะ Prisma ยังไม่รองรับ vector type โดยตรง
      await this.prisma.$executeRaw`
        INSERT INTO "EpisodeChunk" (id, "episodeId", "novelId", "chunkIndex", content, embedding, "createdAt")
        VALUES (
          gen_random_uuid()::text,
          ${episodeId},
          ${episode.novelId},
          ${i},
          ${chunkText},
          ${`[${embedding.join(',')}]`}::vector(768),
          NOW()
        )
        ON CONFLICT DO NOTHING
      `;
      this.logger.log(`💾 [RAG:embed] chunk[${i}] saved to DB ✅`);
    }

    this.logger.log(
      `✅ [RAG:embed] DONE — "${episode.title}" → ${chunks.length} chunks embedded & stored`,
    );
    this.logger.log(`${SEP}`);
  }

  /**
   * ค้นหา chunks ที่เกี่ยวข้องที่สุดกับ query ใน novel นั้น
   * ใช้ cosine similarity จาก pgvector
   */
  async retrieveRelevantChunks(
    novelId: string,
    ragQuery: string,
    topK = 5,
  ): Promise<string[]> {
    this.logger.log(`🔎 [RAG:search] novelId: ${novelId} | topK: ${topK}`);
    this.logger.log(`🔎 [RAG:search] ragQuery: "${preview(ragQuery, 150)}"`);

    const queryEmbedding = await this.aiService.generateEmbedding(ragQuery);
    this.logger.log(
      `🔎 [RAG:search] query embedding OK (${queryEmbedding.length} dims)`,
    );

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // CTE keeps the embedding vector parameterized only once and filters by distance threshold
    const distanceThreshold = this.COSINE_DISTANCE_THRESHOLD;
    const results = await this.prisma.$queryRaw<{ content: string }[]>`
      WITH ranked AS (
        SELECT content, embedding <=> ${embeddingStr}::vector(768) AS dist
        FROM "EpisodeChunk"
        WHERE "novelId" = ${novelId}
          AND embedding IS NOT NULL
        ORDER BY dist
        LIMIT ${topK}
      )
      SELECT content FROM ranked WHERE dist < ${distanceThreshold}
    `;

    this.logger.log(`🔎 [RAG:search] retrieved ${results.length} chunk(s)`);
    results.forEach((r, i) => {
      this.logger.verbose(`  result[${i}]: "${preview(r.content)}"`);
    });

    return results.map((r) => r.content);
  }

  /**
   * สร้าง context string สำหรับ AI System Prompt
   * รวม NovelContext (ตัวละคร, โลก, โครงเรื่อง) + relevant chunks
   */
  async buildContext(novelId: string, ragQuery: string): Promise<string> {
    this.logger.log(
      `🏗️  [RAG:context] Building context for novelId: ${novelId}`,
    );

    const [novelContext, relevantChunks] = await Promise.all([
      this.prisma.novelContext.findUnique({ where: { novelId } }),
      this.retrieveRelevantChunks(novelId, ragQuery),
    ]);

    const contextParts: string[] = [];

    if (novelContext) {
      const presentFields = (
        [
          ['characters', 'ตัวละครหลัก'],
          ['worldBuilding', 'ฉากและโลกในเรื่อง'],
          ['plotOutline', 'โครงเรื่องหลัก'],
          ['writingStyle', 'สไตล์การเขียน'],
        ] as [keyof typeof novelContext, string][]
      ).filter(([key]) => !!novelContext[key]);

      this.logger.log(
        `🏗️  [RAG:context] NovelContext found — sections: ${presentFields.length > 0 ? presentFields.map(([, label]) => label).join(', ') : 'none'}`,
      );

      for (const [key, label] of presentFields) {
        contextParts.push(`## ${label}\n${novelContext[key] as string}`);
      }
    } else {
      this.logger.warn(
        `🏗️  [RAG:context] NovelContext NOT found for novelId: ${novelId}`,
      );
    }

    if (relevantChunks.length > 0) {
      contextParts.push(
        `## เนื้อเรื่องที่เกี่ยวข้อง\n${relevantChunks.join('\n\n---\n\n')}`,
      );
    } else {
      this.logger.warn(
        `🏗️  [RAG:context] No relevant RAG chunks found — novel may not have embedded episodes yet`,
      );
    }

    const result = contextParts.join('\n\n');

    this.logger.log(
      `🏗️  [RAG:context] Context built — ${result.length} chars total (${contextParts.length} section(s))`,
    );

    if (result.length > 0) {
      this.logger.verbose(
        `${SEP}\n[RAG CONTEXT — ${result.length} chars]\n${SEP}\n${result}\n${SEP}`,
      );
    }

    return result;
  }
}
