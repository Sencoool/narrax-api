import { Injectable, Inject } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';
import { EnsureEpisodeOwnershipUseCase } from './ensure-episode-ownership.use-case.js';
import { MAX_REVISIONS_PER_EPISODE } from './update-episode.use-case.js';

export interface RestoreEpisodeRevisionInput {
  episodeId: string;
  revisionId: string;
  userId: string;
}

/**
 * Puts a stored snapshot back into the episode.
 *
 * The live text is snapshotted first, so a restore is itself undoable: pick the
 * wrong revision and the pre-restore state is still in the history.
 */
@Injectable()
export class RestoreEpisodeRevisionUseCase {
  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
    private readonly ensureEpisodeOwnership: EnsureEpisodeOwnershipUseCase,
  ) {}

  async execute(input: RestoreEpisodeRevisionInput): Promise<EpisodeEntity> {
    // Throws DomainNotFoundError (404) or DomainForbiddenError (403)
    await this.ensureEpisodeOwnership.execute(input.episodeId, input.userId);

    const revision = await this.episodeRepo.findRevision(input.revisionId);

    // A revision that belongs to a different episode must not be reachable
    // through this episode's route, even for its owner.
    if (!revision || revision.episodeId !== input.episodeId) {
      throw new DomainNotFoundError('เวอร์ชันตอน', input.revisionId);
    }

    const current = await this.episodeRepo.findById(input.episodeId);
    if (current) {
      await this.episodeRepo.createRevision({
        episodeId: current.id,
        title: current.title,
        content: current.content,
        order: current.order,
        cast: current.cast,
      });
      await this.episodeRepo.pruneRevisions(
        current.id,
        MAX_REVISIONS_PER_EPISODE,
      );
    }

    return this.episodeRepo.update(input.episodeId, {
      title: revision.title,
      content: revision.content,
      order: revision.order,
      cast: revision.cast,
    });
  }
}
