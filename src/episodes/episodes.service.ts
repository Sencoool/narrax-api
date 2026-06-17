import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RagService } from '../rag/rag.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';

@Injectable()
export class EpisodesService {
  private readonly logger = new Logger(EpisodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
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
        content: input.content,
        order,
        isPublished: input.isPublished ?? false,
      },
    });

    // Trigger RAG embedding แบบ async (ไม่รอให้เสร็จ)
    // ทำให้ response เร็ว แต่ embedding จะพร้อมใช้หลังสักครู่
    this.triggerEmbedding(episode.id, episode.title);

    return episode;
  }

  async uploadContent(novelId: string, file: Express.Multer.File, title: string, order: number) {
    const text = file.buffer.toString('utf-8');
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
        title: title || `ตอนที่ ${targetOrder}`,
        content: text,
        order: targetOrder,
        isPublished: false,
      },
    });

    this.triggerEmbedding(episode.id, episode.title);

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
}
