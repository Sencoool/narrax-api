import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import {
  DomainNotFoundError,
  DomainForbiddenError,
  DomainValidationError,
} from '../../../domain/errors/domain-errors.js';

export interface UploadEpisodeContentInput {
  novelId: string;
  userId: string;
  /** Raw text already extracted from the uploaded file. */
  text: string;
  title: string | null;
  order?: number;
}

/**
 * Creates an episode populated with uploaded text content.
 *
 * File parsing (buffer -> string) is done at the controller/infrastructure
 * level before calling this use case. This use case only handles the
 * business logic: auto-ordering, title fallback, and persistence.
 *
 * Triggering RAG embedding and summary generation remains the caller's
 * responsibility (fire-and-forget side effects).
 */
@Injectable()
export class UploadEpisodeContentUseCase {
  private readonly logger = new Logger(UploadEpisodeContentUseCase.name);

  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  async execute(input: UploadEpisodeContentInput): Promise<EpisodeEntity> {
    if (!input.text.trim()) {
      throw new DomainValidationError('ไฟล์ที่อัปโหลดไม่มีเนื้อหา');
    }

    const novel = await this.novelRepo.findById(input.novelId);
    if (!novel) {
      throw new DomainNotFoundError('นิยาย', input.novelId);
    }
    if (!novel.isOwnedBy(input.userId)) {
      throw new DomainForbiddenError('คุณไม่มีสิทธิ์เพิ่มตอนในนิยายนี้');
    }

    let order = input.order;
    if (!order) {
      const lastOrder = await this.episodeRepo.findLastOrderByNovelId(
        input.novelId,
      );
      order = lastOrder + 1;
      this.logger.debug(
        `Auto-assigned order=${order} for novel ${input.novelId}`,
      );
    }

    const title = input.title?.trim() || `ตอนที่ ${order}`;

    return this.episodeRepo.create({
      novelId: input.novelId,
      title,
      content: input.text,
      order,
      isPublished: false,
    });
  }
}