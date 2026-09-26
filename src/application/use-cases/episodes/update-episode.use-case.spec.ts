import {
  UpdateEpisodeUseCase,
  MAX_REVISIONS_PER_EPISODE,
} from './update-episode.use-case';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';

function makeEpisode(overrides: { title?: string; content?: string } = {}) {
  return new EpisodeEntity({
    id: 'episode-1',
    novelId: 'novel-1',
    title: overrides.title ?? 'Episode',
    content: overrides.content ?? 'once upon a time',
    episodeSummary: null,
    order: 1,
    isPublished: false,
    cast: ['Ari'],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('UpdateEpisodeUseCase', () => {
  const episodeRepo = {
    findById: jest.fn(),
    update: jest.fn(),
    createRevision: jest.fn(),
    pruneRevisions: jest.fn(),
  };
  const ensureEpisodeOwnership = { execute: jest.fn() };
  const useCase = new UpdateEpisodeUseCase(
    episodeRepo as never,
    ensureEpisodeOwnership as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    ensureEpisodeOwnership.execute.mockResolvedValue(makeEpisode());
    episodeRepo.update.mockResolvedValue(makeEpisode());
    episodeRepo.createRevision.mockResolvedValue(undefined);
    episodeRepo.pruneRevisions.mockResolvedValue(0);
  });

  it('snapshots the previous text before overwriting it', async () => {
    episodeRepo.findById.mockResolvedValue(makeEpisode());

    await useCase.execute('episode-1', 'user-1', { content: 'a new draft' });

    expect(episodeRepo.createRevision).toHaveBeenCalledWith({
      episodeId: 'episode-1',
      title: 'Episode',
      content: 'once upon a time',
      order: 1,
      cast: ['Ari'],
    });
  });

  it('prunes the history to MAX_REVISIONS_PER_EPISODE', async () => {
    episodeRepo.findById.mockResolvedValue(makeEpisode());

    await useCase.execute('episode-1', 'user-1', { content: 'a new draft' });

    expect(episodeRepo.pruneRevisions).toHaveBeenCalledWith(
      'episode-1',
      MAX_REVISIONS_PER_EPISODE,
    );
  });

  it('does not snapshot when the content is unchanged', async () => {
    episodeRepo.findById.mockResolvedValue(makeEpisode());

    await useCase.execute('episode-1', 'user-1', {
      content: 'once upon a time',
    });

    expect(episodeRepo.createRevision).not.toHaveBeenCalled();
    expect(episodeRepo.pruneRevisions).not.toHaveBeenCalled();
  });

  it('does not snapshot metadata-only updates', async () => {
    episodeRepo.findById.mockResolvedValue(makeEpisode());

    await useCase.execute('episode-1', 'user-1', {
      isPublished: true,
      order: 4,
      cast: ['Ari', 'Bo'],
    });

    expect(episodeRepo.createRevision).not.toHaveBeenCalled();
  });

  it('still updates when the episode row disappeared between checks', async () => {
    episodeRepo.findById.mockResolvedValue(null);

    await useCase.execute('episode-1', 'user-1', { content: 'a new draft' });

    expect(episodeRepo.createRevision).not.toHaveBeenCalled();
    expect(episodeRepo.update).toHaveBeenCalled();
  });

  it('refuses to touch an episode the caller does not own', async () => {
    ensureEpisodeOwnership.execute.mockRejectedValue(new Error('forbidden'));

    await expect(
      useCase.execute('episode-1', 'user-2', { content: 'a new draft' }),
    ).rejects.toThrow('forbidden');
    expect(episodeRepo.update).not.toHaveBeenCalled();
  });
});
