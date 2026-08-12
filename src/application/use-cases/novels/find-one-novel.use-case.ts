import { Injectable, Inject } from '@nestjs/common';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import { NovelEntity } from '../../../domain/entities/novel.entity.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

@Injectable()
export class FindOneNovelUseCase {
  constructor(
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  async execute(id: string): Promise<NovelEntity> {
    const novel = await this.novelRepo.findById(id);
    if (!novel) {
      throw new DomainNotFoundError('นิยาย', id);
    }
    return novel;
  }
}
