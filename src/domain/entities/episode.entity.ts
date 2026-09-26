export interface EpisodeProps {
  id: string;
  novelId: string;
  title: string;
  content: string;
  episodeSummary: string | null;
  order: number;
  isPublished: boolean;
  cast: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Episode domain entity.
 *
 * Business rules:
 * - Episodes within the same novel must have unique order values (enforced at DB level).
 * - Content may be empty string for newly-created episodes (content is uploaded separately).
 * - An AI summary is generated asynchronously and may be null until available.
 */
export class EpisodeEntity {
  readonly id: string;
  readonly novelId: string;
  readonly title: string;
  readonly content: string;
  readonly episodeSummary: string | null;
  readonly order: number;
  readonly isPublished: boolean;
  readonly cast: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: EpisodeProps) {
    this.id = props.id;
    this.novelId = props.novelId;
    this.title = props.title;
    this.content = props.content;
    this.episodeSummary = props.episodeSummary;
    this.order = props.order;
    this.isPublished = props.isPublished;
    this.cast = props.cast ?? [];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  hasContent(): boolean {
    return this.content.trim().length > 0;
  }

  hasSummary(): boolean {
    return (
      this.episodeSummary !== null && this.episodeSummary.trim().length > 0
    );
  }

  /**
   * Returns the tail of the episode content used as RAG query seed.
   * Mirrors the 1500-char slice used in story-generation-stream.controller.ts.
   */
  contentTail(maxChars = 1500): string {
    return this.content.slice(-maxChars);
  }
}
