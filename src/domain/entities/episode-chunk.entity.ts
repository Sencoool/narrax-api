/**
 * EpisodeChunk domain entity.
 *
 * Represents a single semantic chunk of an episode's content that has been
 * embedded into a vector for RAG (Retrieval-Augmented Generation) search.
 *
 * NOTE: The `embedding` field is NOT stored here — vectors are managed
 * exclusively at the infrastructure layer via raw SQL (pgvector).
 * This entity carries the text content and metadata only.
 */
export interface EpisodeChunkProps {
  id: string;
  episodeId: string;
  novelId: string;
  chunkIndex: number;
  content: string;
  createdAt: Date;
}

export class EpisodeChunkEntity {
  readonly id: string;
  readonly episodeId: string;
  readonly novelId: string;
  readonly chunkIndex: number;
  readonly content: string;
  readonly createdAt: Date;

  constructor(props: EpisodeChunkProps) {
    this.id = props.id;
    this.episodeId = props.episodeId;
    this.novelId = props.novelId;
    this.chunkIndex = props.chunkIndex;
    this.content = props.content;
    this.createdAt = props.createdAt;
  }

  /** Word count — useful for logging and chunk-size validation. */
  wordCount(): number {
    return this.content.trim().split(/\s+/).length;
  }
}
