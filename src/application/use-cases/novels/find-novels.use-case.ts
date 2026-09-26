import { Injectable, Inject } from '@nestjs/common';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import type {
  FindNovelsFilter,
  PaginatedNovels,
} from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import type { NovelStatusValue } from '../../../domain/value-objects/novel-status.vo.js';

export interface FindNovelsInput {
  status?: NovelStatusValue;
  authorId?: string;
  page: number;
  limit: number;
}

@Injectable()
export class FindNovelsUseCase {
  constructor(
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  execute(input: FindNovelsInput, callerId?: string): Promise<PaginatedNovels> {
    const filter: FindNovelsFilter = {
      status: input.status,
      authorId: input.authorId,
      // Signed in or not, published work is public; a caller also sees their own.
      includeDraftsFor: callerId,
      page: input.page,
      limit: input.limit,
    };
    return this.novelRepo.findAll(filter);
  }
}
