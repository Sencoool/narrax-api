import { Injectable, Inject } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

@Injectable()
export class FindOneEpisodeUseCase {
  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
  ) {}

  async execute(id: string): Promise<EpisodeEntity> {
    const episode = await this.episodeRepo.findById(id);
    if (!episode) {
      throw new DomainNotFoundError('ตอน', id);
    }
    return episode;
  }
}
