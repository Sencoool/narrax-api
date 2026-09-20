import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  IEpisodeRepository,
  CreateEpisodeData,
  UpdateEpisodeData,
  EpisodeSummaryItem,
} from '../../../domain/repositories/episode.repository.interface.js';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import { EpisodeMapper } from '../mappers/episode.mapper.js';

@Injectable()
export class PrismaEpisodeRepository implements IEpisodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<EpisodeEntity | null> {
    const raw = await this.prisma.episode.findUnique({ where: { id } });
    return raw ? EpisodeMapper.toDomain(raw) : null;
  }

  async findByNovelId(novelId: string): Promise<EpisodeSummaryItem[]> {
    const rows = await this.prisma.episode.findMany({
      where: { novelId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        novelId: true,
        title: true,
        order: true,
        isPublished: true,
        episodeSummary: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { chunks: true } },
      },
    });

    return rows.map((r: typeof rows[number]) => ({
      id: r.id,
      novelId: r.novelId,
      title: r.title,
      order: r.order,
      isPublished: r.isPublished,
      episodeSummary: r.episodeSummary,
      chunkCount: r._count.chunks,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findLastOrderByNovelId(novelId: string): Promise<number> {
    const last = await this.prisma.episode.findFirst({
      where: { novelId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return last?.order ?? 0;
  }

  async create(data: CreateEpisodeData): Promise<EpisodeEntity> {
    const raw = await this.prisma.episode.create({
      data: {
        novelId: data.novelId,
        title: data.title,
        content: data.content,
        order: data.order,
        isPublished: data.isPublished,
      },
    });
    return EpisodeMapper.toDomain(raw);
  }

  async update(id: string, data: UpdateEpisodeData): Promise<EpisodeEntity> {
    const raw = await this.prisma.episode.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        episodeSummary: data.episodeSummary,
        order: data.order,
        isPublished: data.isPublished,
        cast: data.cast,
      },
    });
    return EpisodeMapper.toDomain(raw);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.episode.delete({ where: { id } });
  }
}
