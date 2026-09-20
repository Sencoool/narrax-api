import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface CreateEpisodeInput {
  title: string;
  order?: number;
  isPublished?: boolean;
  content?: string;
  cast?: string[];
}

/**
 * Creates a new episode.
 * If `order` is not supplied, it auto-increments to last + 1.
 * Returns the saved EpisodeEntity (content is empty; uploading content is a separate use case).
 *
 * NOTE: Triggering RAG embedding and summary generation are side-effect use cases
 * (ChunkAndEmbedUseCase, GenerateEpisodeSummaryUseCase) called by the controller
 * in fire-and-forget fashion — not this use case's responsibility.
 */
@Injectable()
export class CreateEpisodeUseCase {
  private readonly logger = new Logger(CreateEpisodeUseCase.name);

  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
  ) {}

  async execute(
    novelId: string,
    input: CreateEpisodeInput,
  ): Promise<EpisodeEntity> {
    let order = input.order;
    if (!order) {
      const lastOrder = await this.episodeRepo.findLastOrderByNovelId(novelId);
      order = lastOrder + 1;
      this.logger.debug(`Auto-assigned order=${order} for novel ${novelId}`);
    }

    return this.episodeRepo.create({
      novelId,
      title: input.title,
      content: input.content ?? '',
      order,
      isPublished: input.isPublished ?? false,
      cast: input.cast,
    });
  }
}
