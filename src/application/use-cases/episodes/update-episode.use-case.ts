import { Injectable, Inject } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import type { UpdateEpisodeData } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import { EnsureEpisodeOwnershipUseCase } from './ensure-episode-ownership.use-case.js';

/**
 * How many snapshots to keep per episode. The editor autosaves on a ~2.5s
 * debounce, so an unbounded history would grow quickly; the newest few are
 * enough to recover an accidental overwrite or a select-all-delete.
 */
export const MAX_REVISIONS_PER_EPISODE = 5;

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
 * Before an update that would overwrite the text, the previous state is
 * snapshotted into EpisodeRevision and the history is pruned to
 * MAX_REVISIONS_PER_EPISODE. Metadata-only updates (publish, reorder, cast,
 * summary) are not snapshotted — they can't lose writing.
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

  async execute(
    id: string,
    userId: string,
    input: UpdateEpisodeInput,
  ): Promise<EpisodeEntity> {
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

    const current = await this.episodeRepo.findById(id);
    if (current && wouldOverwriteText(current, input)) {
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

    return this.episodeRepo.update(id, data);
  }
}

/**
 * True when the update would replace existing text, i.e. when the revision is
 * worth keeping. Publish/reorder/cast changes deliberately return false.
 */
function wouldOverwriteText(
  current: EpisodeEntity,
  input: UpdateEpisodeInput,
): boolean {
  const titleChanges =
    input.title !== undefined && input.title !== current.title;
  const contentChanges =
    input.content !== undefined && input.content !== current.content;

  return titleChanges || contentChanges;
}
