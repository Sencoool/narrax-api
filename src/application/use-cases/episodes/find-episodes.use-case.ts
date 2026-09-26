import { Injectable, Inject } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import type { EpisodeSummaryItem } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';
import type { Viewer } from '../../../domain/services/content-visibility.js';
import {
  canRead,
  isAuthor,
} from '../../../domain/services/content-visibility.js';

@Injectable()
export class FindEpisodesUseCase {
  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  async execute(
    novelId: string,
    viewer?: Viewer,
  ): Promise<EpisodeSummaryItem[]> {
    const novel = await this.novelRepo.findById(novelId);
    if (!novel || !canRead(novel.status, novel.authorId, viewer)) {
      throw new DomainNotFoundError('นิยาย', novelId);
    }

    const episodes = await this.episodeRepo.findByNovelId(novelId);

    // The author sees the whole list; anyone else sees only what is published.
    // Filtering here rather than in SQL is safe because this list is not
    // paginated — it is one novel's episodes.
    return isAuthor(novel.authorId, viewer)
      ? episodes
      : episodes.filter((episode) => episode.isPublished);
  }
}
