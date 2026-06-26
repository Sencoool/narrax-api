import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RagService } from '../rag/rag.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { FileParserService } from './file-parser.service';


@Injectable()
export class EpisodesService {
  private readonly logger = new Logger(EpisodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
    private readonly aiService: AiService,
    private readonly fileParserService: FileParserService,
  ) { }

  async create(novelId: string, input: CreateEpisodeDto) {
    // คำนวณ order ถ้าไม่ได้ระบุ → ต่อท้ายตอนสุดท้าย
    let order = input.order;
    if (!order) {
      const lastEpisode = await this.prisma.episode.findFirst({
        where: { novelId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = (lastEpisode?.order ?? 0) + 1;
    }

    const episode = await this.prisma.episode.create({
      data: {
        novelId,
        title: input.title,
        content: "",
        order,
        isPublished: input.isPublished ?? false,
      },
    });

    // Trigger RAG embedding แบบ async (ไม่รอให้เสร็จ)
    this.triggerEmbedding(episode.id, episode.title);

    // Auto-generate AI summary in the background if content is provided
    if (input.content) {
      this.triggerSummaryGeneration(episode.id, episode.title, input.content);
    }

    return episode;
  }

  async uploadContent(novelId: string, file: Express.Multer.File, title: string, order: number) {
    // Extract text using dedicated parser (throws 415 on bad file type / empty file)
    const text = this.fileParserService.extractText(file);

    let targetOrder = order;
    if (!targetOrder) {
      const lastEpisode = await this.prisma.episode.findFirst({
        where: { novelId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      targetOrder = (lastEpisode?.order ?? 0) + 1;
    }

    const episode = await this.prisma.episode.create({
      data: {
        novelId,
        title: title?.trim() || `ตอนที่ ${targetOrder}`,
        content: text,
        order: targetOrder,
        isPublished: false,
      },
    });

    // RAG embedding — async fire-and-forget so upload returns immediately
    this.triggerEmbedding(episode.id, episode.title);

    // Auto-generate AI summary in the background
    this.triggerSummaryGeneration(episode.id, episode.title, text);

    return episode;
  }

  async findAll(novelId: string) {
    const novelExists = await this.prisma.novel.count({
      where: { id: novelId },
    });
    if (!novelExists) {
      throw new NotFoundException(`ไม่พบนิยาย id: ${novelId}`);
    }

    return this.prisma.episode.findMany({
      where: { novelId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        order: true,
        isPublished: true,
        episodeSummary: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { chunks: true } },
      },
    });
  }

  async findOne(id: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id },
      include: {
        _count: { select: { chunks: true } },
      },
    });

    if (!episode) {
      throw new NotFoundException(`ไม่พบตอน id: ${id}`);
    }

    return episode;
  }

  async update(id: string, input: UpdateEpisodeDto) {
    const existing = await this.prisma.episode.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!existing) {
      throw new NotFoundException(`ไม่พบตอน id: ${id}`);
    }

    const episode = await this.prisma.episode.update({
      where: { id },
      data: input,
    });

    // Re-embed ถ้า content เปลี่ยน
    if (input.content) {
      this.triggerEmbedding(episode.id, episode.title);
      // Re-generate summary when content changes
      this.triggerSummaryGeneration(episode.id, episode.title, input.content);
    }

    return episode;
  }

  async remove(id: string) {
    const existing = await this.prisma.episode.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`ไม่พบตอน id: ${id}`);
    }

    // EpisodeChunks จะถูกลบอัตโนมัติ (onDelete: Cascade ใน schema)
    await this.prisma.episode.delete({ where: { id } });
    return { message: 'ลบตอนเรียบร้อยแล้ว' };
  }

  /**
   * Generate (or re-generate) an AI summary for an episode and persist it.
   * Called directly from the controller for the manual re-generate button.
   */
  async generateSummary(id: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id },
      select: { id: true, title: true, content: true },
    });

    if (!episode) {
      throw new NotFoundException(`ไม่พบตอน id: ${id}`);
    }

    if (!episode.content?.trim()) {
      throw new NotFoundException(`ตอนนี้ยังไม่มีเนื้อหา ไม่สามารถสร้าง summary ได้`);
    }

    const summary = await this.callAiSummary(episode.title, episode.content);

    const updated = await this.prisma.episode.update({
      where: { id },
      data: { episodeSummary: summary },
    });

    return updated;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Embed episode โดยไม่รอผลลัพธ์ — log error ถ้าล้มเหลว
   */
  private triggerEmbedding(episodeId: string, episodeTitle: string): void {
    this.ragService
      .chunkAndEmbed(episodeId)
      .then(() => {
        this.logger.log(`✅ Embedded episode: "${episodeTitle}"`);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `❌ Failed to embed episode "${episodeTitle}": ${msg}`,
        );
      });
  }

  /**
   * Fire-and-forget summary generation — persists result to DB, logs errors.
   */
  private triggerSummaryGeneration(episodeId: string, episodeTitle: string, content: string): void {
    this.callAiSummary(episodeTitle, content)
      .then((summary) =>
        this.prisma.episode.update({
          where: { id: episodeId },
          data: { episodeSummary: summary },
        }),
      )
      .then(() => {
        this.logger.log(`✅ Generated summary for episode: "${episodeTitle}"`);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `❌ Failed to generate summary for episode "${episodeTitle}": ${msg}`,
        );
      });
  }

  /**
   * Calls the AI model to produce a concise episode summary.
   * The prompt instructs the model to respond in the same language as the content.
   */
  private async callAiSummary(episodeTitle: string, content: string): Promise<string> {
    const systemPrompt = `You are a skilled literary assistant who specializes in summarizing novel episodes.
Your task is to write a concise, engaging summary of the provided episode.

Rules:
- Detect the language of the episode content and respond in that same language.
- Length: 3–5 sentences.
- Capture the key plot events, character actions, and emotional tone.
- Do NOT include spoiler warnings or meta-commentary about the summary itself.
- Return ONLY the summary text, nothing else.`;

    const userMessage = `Episode title: "${episodeTitle}"

Episode content:
${content}`;

    return this.aiService.generate(systemPrompt, userMessage, {
      temperature: 0.5,
      maxOutputTokens: 512,
    });
  }
}
