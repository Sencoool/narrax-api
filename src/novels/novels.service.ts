import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNovelDto } from './dto/create-novel.dto';
import { FindNovelsDto } from './dto/find-novels.dto';
import { UpdateNovelDto } from './dto/update-novel.dto';
import { UpsertNovelContextDto } from './dto/upsert-novel-context.dto';
import { NovelContextService } from './novel-context.service';

@Injectable()
export class NovelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly novelContext: NovelContextService,
  ) { }

  async create(authorId: string, input: CreateNovelDto) {
    const { tags, ...novelData } = input;

    return this.prisma.novel.create({
      data: {
        ...novelData,
        authorId,
        context: { create: {} },
        tags: tags?.length
          ? {
            create: tags.map((tagName) => ({
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
      include: {
        tags: { include: { tag: true } },
        context: true,
        _count: { select: { episodes: true } },
      },
    });
  }

  async findAll(query: FindNovelsDto) {
    const { status, authorId, page, limit } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(status ? { status } : {}),
      ...(authorId ? { authorId } : {}),
    };

    const [novels, total] = await Promise.all([
      this.prisma.novel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          tags: { include: { tag: true } },
          _count: { select: { episodes: true } },
        },
      }),
      this.prisma.novel.count({ where }),
    ]);

    return {
      data: novels,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        context: true,
        _count: { select: { episodes: true, chunks: true } },
      },
    });

    if (!novel) {
      throw new NotFoundException(`ไม่พบนิยาย id: ${id}`);
    }

    return novel;
  }

  async update(id: string, authorId: string, input: UpdateNovelDto) {
    await this.assertOwnership(id, authorId);
    return this.prisma.novel.update({
      where: { id },
      data: {
        ...input,
        tags: input.tags?.length
          ? {
            deleteMany: {},
            create: input.tags.map((tagName) => ({
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
      include: {
        tags: { include: { tag: true } },
        _count: { select: { episodes: true } },
      },
    });
  }

  async remove(id: string, authorId: string) {
    await this.assertOwnership(id, authorId);

    await this.prisma.novel.delete({ where: { id } });
    return { message: 'ลบนิยายเรียบร้อยแล้ว' };
  }

  // --- Context delegation ---

  findContext(novelId: string) {
    return this.novelContext.findOne(novelId);
  }

  upsertContext(novelId: string, input: UpsertNovelContextDto) {
    return this.novelContext.upsert(novelId, input);
  }

  // --- Private helpers ---

  private async assertOwnership(novelId: string, authorId: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      select: { authorId: true },
    });

    if (!novel) {
      throw new NotFoundException(`ไม่พบนิยาย id: ${novelId}`);
    }
    if (novel.authorId !== authorId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์แก้ไขนิยายนี้');
    }
  }
}
