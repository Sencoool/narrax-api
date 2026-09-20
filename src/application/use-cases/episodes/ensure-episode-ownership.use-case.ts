import { Injectable, Inject } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import {
  DomainNotFoundError,
  DomainForbiddenError,
} from '../../../domain/errors/domain-errors.js';

/**
 * Resolves an episode and asserts that the requesting user owns the novel it
 * belongs to.
 *
 * Episodes have no author of their own — ownership is derived from the parent
 * novel, the same rule UpdateNovelUseCase / DeleteNovelUseCase apply. Throws
 * DomainNotFoundError when the episode or its novel is gone, and
 * DomainForbiddenError when it belongs to somebody else.
 */
@Injectable()
export class EnsureEpisodeOwnershipUseCase {
  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  async execute(episodeId: string, userId: string): Promise<EpisodeEntity> {
    const episode = await this.episodeRepo.findById(episodeId);
    if (!episode) {
      throw new DomainNotFoundError('ตอน', episodeId);
    }

    const novel = await this.novelRepo.findById(episode.novelId);
    if (!novel) {
      throw new DomainNotFoundError('นิยาย', episode.novelId);
    }

    if (!novel.isOwnedBy(userId)) {
      throw new DomainForbiddenError('คุณไม่มีสิทธิ์เข้าถึงข้อมูลของตอนนี้');
    }

    return episode;
  }
}
