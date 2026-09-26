import type { EpisodeEntity } from '../entities/episode.entity.js';

export interface CreateEpisodeData {
  novelId: string;
  title: string;
  content: string;
  order: number;
  isPublished: boolean;
  cast?: string[];
}

export interface UpdateEpisodeData {
  title?: string;
  content?: string;
  episodeSummary?: string | null;
  order?: number;
  isPublished?: boolean;
  cast?: string[];
}

/** Snapshot written before an update overwrites an episode's text. */
export interface CreateEpisodeRevisionData {
  episodeId: string;
  title: string;
  content: string;
  order: number;
  cast: string[];
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
  /** Writes a snapshot of an episode's content, as it was before the update. */
  createRevision(data: CreateEpisodeRevisionData): Promise<void>;
  /** Deletes all but the newest `keep` revisions; returns how many were removed. */
  pruneRevisions(episodeId: string, keep: number): Promise<number>;
  delete(id: string): Promise<void>;
}

/** NestJS DI injection token for IEpisodeRepository. */
export const EPISODE_REPOSITORY = Symbol('IEpisodeRepository');
