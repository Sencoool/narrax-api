import { Injectable, Inject } from '@nestjs/common';
import {
  IEpisodeRepository,
  EPISODE_REPOSITORY,
  UpdateEpisodeData,
} from '../../../domain/repositories/episode.repository.interface.js';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface UpdateEpisodeInput {
  title?: string;
  content?: string;
  episodeSummary?: string | null;
  order?: number;
  isPublished?: boolean;
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
  ) {}

  async execute(id: string, input: UpdateEpisodeInput): Promise<EpisodeEntity> {
    const existing = await this.episodeRepo.findById(id);
    if (!existing) {
      throw new DomainNotFoundError('ตอน', id);
    }

    const data: UpdateEpisodeData = {
      title: input.title,
      content: input.content,
      episodeSummary: input.episodeSummary,
      order: input.order,
      isPublished: input.isPublished,
    };

    return this.episodeRepo.update(id, data);
  }
}
