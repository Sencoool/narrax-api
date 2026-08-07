import { Injectable, Inject } from '@nestjs/common';
import {
  INovelRepository,
  NOVEL_REPOSITORY,
  CreateNovelData,
} from '../../../domain/repositories/novel.repository.interface.js';
import { NovelEntity } from '../../../domain/entities/novel.entity.js';

export interface CreateNovelInput {
  title: string;
  summary: string | null;
  tags?: string[];
}

@Injectable()
export class CreateNovelUseCase {
  constructor(
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  execute(authorId: string, input: CreateNovelInput): Promise<NovelEntity> {
    const data: CreateNovelData = {
      title: input.title,
      summary: input.summary,
      authorId,
      tags: input.tags,
    };
    return this.novelRepo.create(data);
  }
}
