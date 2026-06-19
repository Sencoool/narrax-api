import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertNovelContextDto } from './dto/upsert-novel-context.dto';

@Injectable()
export class NovelContextService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(novelId: string) {
    await this.assertNovelExists(novelId);

    const context = await this.prisma.novelContext.findUnique({
      where: { novelId },
    });

    return {
      novelId,
      characters: context?.characters
        ? (JSON.parse(context.characters) as unknown[])
        : [],
      worldBuilding: context?.worldBuilding
        ? (JSON.parse(context.worldBuilding) as Record<string, unknown>)
        : null,
      plotOutline: context?.plotOutline ?? null,
      writingStyle: context?.writingStyle ?? null,
      updatedAt: context?.updatedAt ?? null,
    };
  }

  async upsert(novelId: string, input: UpsertNovelContextDto) {
    await this.assertNovelExists(novelId);

    const data: Record<string, string> = {};

    if (input.characters !== undefined) {
      data.characters = JSON.stringify(input.characters);
    }
    if (input.worldBuilding !== undefined) {
      data.worldBuilding = JSON.stringify(input.worldBuilding);
    }
    if (input.plotOutline !== undefined) {
      data.plotOutline = input.plotOutline;
    }
    if (input.writingStyle !== undefined) {
      data.writingStyle = input.writingStyle;
    }

    const context = await this.prisma.novelContext.upsert({
      where: { novelId },
      create: { novelId, ...data },
      update: data,
    });

    return {
      novelId,
      characters: context.characters
        ? (JSON.parse(context.characters) as unknown[])
        : [],
      worldBuilding: context.worldBuilding
        ? (JSON.parse(context.worldBuilding) as Record<string, unknown>)
        : null,
      plotOutline: context.plotOutline ?? null,
      writingStyle: context.writingStyle ?? null,
      updatedAt: context.updatedAt,
    };
  }

  private async assertNovelExists(novelId: string) {
    const exists = await this.prisma.novel.count({ where: { id: novelId } });
    if (!exists) {
      throw new NotFoundException(`ไม่พบนิยาย id: ${novelId}`);
    }
  }
}
