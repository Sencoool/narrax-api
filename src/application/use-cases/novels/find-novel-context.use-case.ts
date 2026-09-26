import { Injectable, Inject } from '@nestjs/common';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import type { NovelContextProps } from '../../../domain/entities/novel.entity.js';
import {
  DomainForbiddenError,
  DomainNotFoundError,
} from '../../../domain/errors/domain-errors.js';

@Injectable()
export class FindNovelContextUseCase {
  constructor(
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  async execute(
    novelId: string,
    userId: string,
  ): Promise<NovelContextProps | null> {
    const novel = await this.novelRepo.findById(novelId);
    if (!novel) {
      throw new DomainNotFoundError('นิยาย', novelId);
    }

    // The story bible — cast, world, plot, style — is authoring data. Reading a
    // published novel does not need it, so it stays with the author.
    if (!novel.isOwnedBy(userId)) {
      throw new DomainForbiddenError('คุณไม่มีสิทธิ์ดู context ของนิยายนี้');
    }

    return this.novelRepo.findContext(novelId);
  }
}
