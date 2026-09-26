import { Injectable, Inject } from '@nestjs/common';
import type {
  IEpisodeRepository,
  EpisodeRevisionItem,
} from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import { EnsureEpisodeOwnershipUseCase } from './ensure-episode-ownership.use-case.js';

/**
 * Lists the stored snapshots for an episode, newest first, so a writer can see
 * what the episode looked like before recent saves.
 */
@Injectable()
export class FindEpisodeRevisionsUseCase {
  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
    private readonly ensureEpisodeOwnership: EnsureEpisodeOwnershipUseCase,
  ) {}

  async execute(
    episodeId: string,
    userId: string,
  ): Promise<EpisodeRevisionItem[]> {
    // Throws DomainNotFoundError (404) or DomainForbiddenError (403)
    await this.ensureEpisodeOwnership.execute(episodeId, userId);

    return this.episodeRepo.findRevisions(episodeId);
  }
}
