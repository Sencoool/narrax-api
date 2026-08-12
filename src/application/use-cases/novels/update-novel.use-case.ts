import { Injectable, Inject } from '@nestjs/common';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import type { UpdateNovelData } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import { NovelEntity } from '../../../domain/entities/novel.entity.js';
import {
  DomainNotFoundError,
  DomainForbiddenError,
} from '../../../domain/errors/domain-errors.js';
import type { NovelStatusValue } from '../../../domain/value-objects/novel-status.vo.js';

export interface UpdateNovelInput {
  title?: string;
  summary?: string | null;
  status?: NovelStatusValue;
  tags?: string[];
}

@Injectable()
export class UpdateNovelUseCase {
  constructor(
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  async execute(
    id: string,
    authorId: string,
    input: UpdateNovelInput,
  ): Promise<NovelEntity> {
    const novel = await this.novelRepo.findById(id);
    if (!novel) {
      throw new DomainNotFoundError('นิยาย', id);
    }
    if (!novel.isOwnedBy(authorId)) {
      throw new DomainForbiddenError('คุณไม่มีสิทธิ์แก้ไขนิยายนี้');
    }

    const data: UpdateNovelData = {
      title: input.title,
      summary: input.summary,
      status: input.status,
      tags: input.tags,
    };

    return this.novelRepo.update(id, data);
  }
}
