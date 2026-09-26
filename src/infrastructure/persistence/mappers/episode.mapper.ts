import type { Episode as PrismaEpisode } from '@prisma/client';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';

/**
 * Maps between Prisma Episode rows and the domain EpisodeEntity.
 */
export class EpisodeMapper {
  static toDomain(raw: PrismaEpisode): EpisodeEntity {
    return new EpisodeEntity({
      id: raw.id,
      novelId: raw.novelId,
      title: raw.title,
      content: raw.content,
      episodeSummary: raw.episodeSummary,
      order: raw.order,
      isPublished: raw.isPublished,
      cast: raw.cast ?? [],
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
