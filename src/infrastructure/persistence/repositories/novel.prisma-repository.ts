import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  INovelRepository,
  CreateNovelData,
  UpdateNovelData,
  FindNovelsFilter,
  PaginatedNovels,
  UpsertNovelContextData,
} from '../../../domain/repositories/novel.repository.interface.js';
import { NovelEntity } from '../../../domain/entities/novel.entity.js';
import type { NovelContextProps } from '../../../domain/entities/novel.entity.js';
import { NovelMapper } from '../mappers/novel.mapper.js';

/** Reusable include shape so all queries return the same relation set. */
const NOVEL_INCLUDE = {
  tags: { include: { tag: true } },
  context: true,
} as const;

@Injectable()
export class PrismaNovelRepository implements INovelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<NovelEntity | null> {
    const raw = await this.prisma.novel.findUnique({
      where: { id },
      include: NOVEL_INCLUDE,
    });
    return raw ? NovelMapper.toDomain(raw) : null;
  }

  async findAll(filter: FindNovelsFilter): Promise<PaginatedNovels> {
    const { status, authorId, page, limit } = filter;
    const skip = (page - 1) * limit;

    const where = {
      ...(status ? { status } : {}),
      ...(authorId ? { authorId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.novel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: NOVEL_INCLUDE,
      }),
      this.prisma.novel.count({ where }),
    ]);

    return {
      data: rows.map((row) => NovelMapper.toDomain(row)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: CreateNovelData): Promise<NovelEntity> {
    const raw = await this.prisma.novel.create({
      data: {
        title: data.title,
        summary: data.summary,
        authorId: data.authorId,
        // Always bootstrap an empty NovelContext alongside a new novel
        context: { create: {} },
        tags: data.tags?.length
          ? {
              create: data.tags.map((tagName: string) => ({
                tag: {
                  connectOrCreate: {
                    where: { name: tagName },
                    create: { name: tagName },
                  },
                },
              })),
            }
          : undefined,
      },
      include: NOVEL_INCLUDE,
    });
    return NovelMapper.toDomain(raw);
  }

  async update(id: string, data: UpdateNovelData): Promise<NovelEntity> {
    const raw = await this.prisma.novel.update({
      where: { id },
      data: {
        title: data.title,
        summary: data.summary,
        status: data.status,
        tags: data.tags?.length
          ? {
              deleteMany: {},
              create: data.tags.map((tagName: string) => ({
                tag: {
                  connectOrCreate: {
                    where: { name: tagName },
                    create: { name: tagName },
                  },
                },
              })),
            }
          : undefined,
      },
      include: NOVEL_INCLUDE,
    });
    return NovelMapper.toDomain(raw);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.novel.delete({ where: { id } });
  }

  // ─── NovelContext sub-operations ────────────────────────────────────────────

  async findContext(novelId: string): Promise<NovelContextProps | null> {
    const raw = await this.prisma.novelContext.findUnique({
      where: { novelId },
    });
    return raw ? NovelMapper.contextToDomain(raw) : null;
  }

  async upsertContext(
    novelId: string,
    data: UpsertNovelContextData,
  ): Promise<NovelContextProps> {
    const raw = await this.prisma.novelContext.upsert({
      where: { novelId },
      create: {
        novelId,
        characters: data.characters ?? null,
        worldBuilding: data.worldBuilding ?? null,
        plotOutline: data.plotOutline ?? null,
        writingStyle: data.writingStyle ?? null,
      },
      update: {
        characters: data.characters,
        worldBuilding: data.worldBuilding,
        plotOutline: data.plotOutline,
        writingStyle: data.writingStyle,
      },
    });
    return NovelMapper.contextToDomain(raw);
  }
}
