import { Injectable, Inject } from '@nestjs/common';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import {
  DomainNotFoundError,
  DomainForbiddenError,
} from '../../../domain/errors/domain-errors.js';

@Injectable()
export class DeleteNovelUseCase {
  constructor(
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  async execute(id: string, authorId: string): Promise<void> {
    const novel = await this.novelRepo.findById(id);
    if (!novel) {
      throw new DomainNotFoundError('นิยาย', id);
    }
    if (!novel.isOwnedBy(authorId)) {
      throw new DomainForbiddenError('คุณไม่มีสิทธิ์ลบนิยายนี้');
    }
    await this.novelRepo.delete(id);
  }
}
