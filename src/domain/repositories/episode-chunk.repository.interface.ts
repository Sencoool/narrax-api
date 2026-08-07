import type { EpisodeChunkEntity } from '../entities/episode-chunk.entity.js';

/**
 * Port (interface) for EpisodeChunk persistence & vector search.
 *
 * The embedding vector itself is handled entirely at the infrastructure layer
 * via raw SQL (pgvector). The domain interface exposes only content-level
 * operations that use plain strings.
 */
export interface IEpisodeChunkRepository {
  /** Delete all existing chunks for an episode before re-embedding. */
  deleteByEpisodeId(episodeId: string): Promise<void>;

  /**
   * Persist a new chunk along with its embedding vector.
   * The embedding is a number[] produced by the AI embedding model.
   */
  createWithEmbedding(data: {
    episodeId: string;
    novelId: string;
    chunkIndex: number;
    content: string;
    embedding: number[];
  }): Promise<EpisodeChunkEntity>;

  /**
   * Retrieve the top-K most semantically similar chunks for a novel,
   * given a query embedding vector.
   *
   * Only chunks whose cosine distance is less than `distanceThreshold`
   * are returned.
   */
  findSimilar(params: {
    novelId: string;
    queryEmbedding: number[];
    topK: number;
    distanceThreshold: number;
  }): Promise<string[]>;
}

/** NestJS DI injection token for IEpisodeChunkRepository. */
export const EPISODE_CHUNK_REPOSITORY = Symbol('IEpisodeChunkRepository');
