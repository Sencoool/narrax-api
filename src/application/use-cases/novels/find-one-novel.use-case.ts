import { Injectable, Inject } from '@nestjs/common';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import { NovelEntity } from '../../../domain/entities/novel.entity.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';
import type { Viewer } from '../../../domain/services/content-visibility.js';
import { canRead } from '../../../domain/services/content-visibility.js';

@Injectable()
export class FindOneNovelUseCase {
  constructor(
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  async execute(id: string, viewer?: Viewer): Promise<NovelEntity> {
    const novel = await this.novelRepo.findById(id);

    // A draft answers 404 to a stranger, not 403: 403 would confirm that a novel
    // with this id exists.
    if (!novel || !canRead(novel.status, novel.authorId, viewer)) {
      throw new DomainNotFoundError('นิยาย', id);
    }

    return novel;
  }
}
