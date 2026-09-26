import { Injectable, Inject } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import type { UpdateEpisodeData } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import { EnsureEpisodeOwnershipUseCase } from './ensure-episode-ownership.use-case.js';

export interface UpdateEpisodeInput {
  title?: string;
  content?: string;
  episodeSummary?: string | null;
  order?: number;
  isPublished?: boolean;
  cast?: string[];
}

/**
 * Updates episode fields.
 *
 * NOTE: When `content` changes, the caller should fire-and-forget
 * ChunkAndEmbedUseCase and GenerateEpisodeSummaryUseCase to re-index
 * and re-summarise — that responsibility belongs to the controller.
 */
@Injectable()
export class UpdateEpisodeUseCase {
  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
    private readonly ensureEpisodeOwnership: EnsureEpisodeOwnershipUseCase,
  ) {}

  async execute(id: string, userId: string, input: UpdateEpisodeInput): Promise<EpisodeEntity> {
    // Throws DomainNotFoundError (404) or DomainForbiddenError (403)
    await this.ensureEpisodeOwnership.execute(id, userId);

    const data: UpdateEpisodeData = {
      title: input.title,
      content: input.content,
      episodeSummary: input.episodeSummary,
      order: input.order,
      isPublished: input.isPublished,
      cast: input.cast,
    };

    return this.episodeRepo.update(id, data);
  }
}