import { Injectable, Inject } from '@nestjs/common';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import type { NovelContextProps } from '../../../domain/entities/novel.entity.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

@Injectable()
export class FindNovelContextUseCase {
  constructor(
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  async execute(novelId: string): Promise<NovelContextProps | null> {
    // Ensure the novel exists first
    const novel = await this.novelRepo.findById(novelId);
    if (!novel) {
      throw new DomainNotFoundError('นิยาย', novelId);
    }
    return this.novelRepo.findContext(novelId);
  }
}
