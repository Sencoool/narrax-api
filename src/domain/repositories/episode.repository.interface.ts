import type { EpisodeEntity } from '../entities/episode.entity.js';

export interface CreateEpisodeData {
  novelId: string;
  title: string;
  content: string;
  order: number;
  isPublished: boolean;
}

export interface UpdateEpisodeData {
  title?: string;
  content?: string;
  episodeSummary?: string | null;
  order?: number;
  isPublished?: boolean;
}

/** Lightweight summary returned in list endpoints — omits heavy `content` field. */
export interface EpisodeSummaryItem {
  id: string;
  novelId: string;
  title: string;
  order: number;
  isPublished: boolean;
  episodeSummary: string | null;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Port (interface) for episode persistence.
 */
export interface IEpisodeRepository {
  findById(id: string): Promise<EpisodeEntity | null>;
  findByNovelId(novelId: string): Promise<EpisodeSummaryItem[]>;
  findLastOrderByNovelId(novelId: string): Promise<number>;
  create(data: CreateEpisodeData): Promise<EpisodeEntity>;
  update(id: string, data: UpdateEpisodeData): Promise<EpisodeEntity>;
  delete(id: string): Promise<void>;
}

/** NestJS DI injection token for IEpisodeRepository. */
export const EPISODE_REPOSITORY = Symbol('IEpisodeRepository');
