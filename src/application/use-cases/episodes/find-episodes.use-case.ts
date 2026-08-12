import { Injectable, Inject } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import type { EpisodeSummaryItem } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';

@Injectable()
export class FindEpisodesUseCase {
  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
  ) {}

  execute(novelId: string): Promise<EpisodeSummaryItem[]> {
    return this.episodeRepo.findByNovelId(novelId);
  }
}
