import type { NovelEntity, NovelContextProps } from '../entities/novel.entity.js';
import type { NovelStatusValue } from '../value-objects/novel-status.vo.js';

export interface CreateNovelData {
  title: string;
  summary: string | null;
  authorId: string;
  tags?: string[];
}

export interface UpdateNovelData {
  title?: string;
  summary?: string | null;
  status?: NovelStatusValue;
  tags?: string[];
}

export interface FindNovelsFilter {
  status?: NovelStatusValue;
  authorId?: string;
  page: number;
  limit: number;
}

export interface PaginatedNovels {
  data: NovelEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UpsertNovelContextData {
  characters?: string | null;
  worldBuilding?: string | null;
  plotOutline?: string | null;
  writingStyle?: string | null;
}

/**
 * Port (interface) for novel persistence.
 */
export interface INovelRepository {
  findById(id: string): Promise<NovelEntity | null>;
  findAll(filter: FindNovelsFilter): Promise<PaginatedNovels>;
  create(data: CreateNovelData): Promise<NovelEntity>;
  update(id: string, data: UpdateNovelData): Promise<NovelEntity>;
  delete(id: string): Promise<void>;

  // NovelContext sub-operations
  findContext(novelId: string): Promise<NovelContextProps | null>;
  upsertContext(novelId: string, data: UpsertNovelContextData): Promise<NovelContextProps>;
}

/** NestJS DI injection token for INovelRepository. */
export const NOVEL_REPOSITORY = Symbol('INovelRepository');
