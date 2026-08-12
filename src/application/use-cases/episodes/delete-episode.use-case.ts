import { Injectable, Inject } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

@Injectable()
export class DeleteEpisodeUseCase {
  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.episodeRepo.findById(id);
    if (!existing) {
      throw new DomainNotFoundError('ตอน', id);
    }
    // EpisodeChunks are cascade-deleted by the DB (onDelete: Cascade in schema)
    await this.episodeRepo.delete(id);
  }
}
