import { Injectable, Inject } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import { EnsureEpisodeOwnershipUseCase } from './ensure-episode-ownership.use-case.js';

@Injectable()
export class DeleteEpisodeUseCase {
  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
    private readonly ensureEpisodeOwnership: EnsureEpisodeOwnershipUseCase,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    // Throws 404 if missing, 403 if the caller does not own the parent novel
    await this.ensureEpisodeOwnership.execute(id, userId);
    // EpisodeChunks are cascade-deleted by the DB (onDelete: Cascade in schema)
    await this.episodeRepo.delete(id);
  }
}
