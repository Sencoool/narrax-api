import type {
  Novel as PrismaNovel,
  NovelContext as PrismaNovelContext,
  NovelTag as PrismaNovelTag,
  Tag as PrismaTag,
} from '@prisma/client';
import { NovelEntity } from '../../../domain/entities/novel.entity.js';
import type { NovelContextProps } from '../../../domain/entities/novel.entity.js';
import type { NovelStatusValue } from '../../../domain/value-objects/novel-status.vo.js';

/** The Prisma shape returned by novel queries that include tags and context. */
type PrismaNovelWithRelations = PrismaNovel & {
  context?: PrismaNovelContext | null;
  tags?: (PrismaNovelTag & { tag: PrismaTag })[];
};

/**
 * Maps between Prisma Novel rows and the domain NovelEntity.
 */
export class NovelMapper {
  static toDomain(raw: PrismaNovelWithRelations): NovelEntity {
    const context: NovelContextProps | null = raw.context
      ? {
          id: raw.context.id,
          novelId: raw.context.novelId,
          characters: raw.context.characters,
          worldBuilding: raw.context.worldBuilding,
          plotOutline: raw.context.plotOutline,
          writingStyle: raw.context.writingStyle,
          updatedAt: raw.context.updatedAt,
        }
      : null;

    const tags = raw.tags?.map((nt) => nt.tag.name) ?? [];

    return new NovelEntity({
      id: raw.id,
      title: raw.title,
      summary: raw.summary,
      status: raw.status as NovelStatusValue,
      authorId: raw.authorId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      context,
      tags,
    });
  }

  static contextToDomain(raw: PrismaNovelContext): NovelContextProps {
    return {
      id: raw.id,
      novelId: raw.novelId,
      characters: raw.characters,
      worldBuilding: raw.worldBuilding,
      plotOutline: raw.plotOutline,
      writingStyle: raw.writingStyle,
      updatedAt: raw.updatedAt,
    };
  }
}
