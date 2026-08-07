import type { NovelStatusValue } from '../value-objects/novel-status.vo.js';

/** Context metadata stored alongside a novel for AI generation. */
export interface NovelContextProps {
  id: string;
  novelId: string;
  characters: string | null;
  worldBuilding: string | null;
  plotOutline: string | null;
  writingStyle: string | null;
  updatedAt: Date;
}

export interface NovelProps {
  id: string;
  title: string;
  summary: string | null;
  status: NovelStatusValue;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  /** Eagerly-loaded context, if available. */
  context?: NovelContextProps | null;
  /** Tag names (flattened from the join table). */
  tags?: string[];
}

/**
 * Novel domain entity.
 *
 * Business rules encoded here:
 * - Only the author can mutate the novel (authorId check).
 * - A novel can only be published after it leaves draft state.
 */
export class NovelEntity {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly status: NovelStatusValue;
  readonly authorId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly context: NovelContextProps | null;
  readonly tags: string[];

  constructor(props: NovelProps) {
    this.id = props.id;
    this.title = props.title;
    this.summary = props.summary;
    this.status = props.status;
    this.authorId = props.authorId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.context = props.context ?? null;
    this.tags = props.tags ?? [];
  }

  isOwnedBy(userId: string): boolean {
    return this.authorId === userId;
  }

  isDraft(): boolean {
    return this.status === 'draft';
  }

  isPublished(): boolean {
    return this.status === 'published';
  }
}
