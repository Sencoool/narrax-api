import { Injectable, Inject } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';
import type { Viewer } from '../../../domain/services/content-visibility.js';
import {
  isAuthor,
  isPublished,
} from '../../../domain/services/content-visibility.js';

@Injectable()
export class FindOneEpisodeUseCase {
  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  async execute(id: string, viewer?: Viewer): Promise<EpisodeEntity> {
    const episode = await this.episodeRepo.findById(id);
    if (!episode) {
      throw new DomainNotFoundError('ตอน', id);
    }

    const novel = await this.novelRepo.findById(episode.novelId);

    // Readable when both the episode and its novel are published, or by the
    // author, who is the only one working on drafts. Anything else is a 404 so a
    // stranger learns nothing about an unpublished episode's existence.
    const readable =
      !!novel &&
      ((isPublished(novel.status) && episode.isPublished) ||
        isAuthor(novel.authorId, viewer));

    if (!readable) {
      throw new DomainNotFoundError('ตอน', id);
    }

    return episode;
  }
}
