import { RestoreEpisodeRevisionUseCase } from './restore-episode-revision.use-case';
import { MAX_REVISIONS_PER_EPISODE } from './update-episode.use-case';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import {
  DomainForbiddenError,
  DomainNotFoundError,
} from '../../../domain/errors/domain-errors.js';

function makeEpisode(overrides: { title?: string; content?: string } = {}) {
  return new EpisodeEntity({
    id: 'episode-1',
    novelId: 'novel-1',
    title: overrides.title ?? 'Live title',
    content: overrides.content ?? 'live text',
    episodeSummary: null,
    order: 2,
    isPublished: false,
    cast: ['Ari'],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRevision(episodeId = 'episode-1') {
  return {
    id: 'rev-1',
    episodeId,
    title: 'Old title',
    content: 'old text',
    order: 1,
    cast: ['Bo'],
    createdAt: new Date('2026-09-26T10:00:00Z'),
  };
}

describe('RestoreEpisodeRevisionUseCase', () => {
  const episodeRepo = {
    findById: jest.fn(),
    findRevision: jest.fn(),
    createRevision: jest.fn(),
    pruneRevisions: jest.fn(),
    update: jest.fn(),
  };
  const ensureEpisodeOwnership = { execute: jest.fn() };
  const useCase = new RestoreEpisodeRevisionUseCase(
    episodeRepo as never,
    ensureEpisodeOwnership as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    ensureEpisodeOwnership.execute.mockResolvedValue(makeEpisode());
    episodeRepo.findById.mockResolvedValue(makeEpisode());
    episodeRepo.findRevision.mockResolvedValue(makeRevision());
    episodeRepo.createRevision.mockResolvedValue(undefined);
    episodeRepo.pruneRevisions.mockResolvedValue(0);
    episodeRepo.update.mockResolvedValue(makeEpisode());
  });

  it('snapshots the live text first, so the restore can itself be undone', async () => {
    await useCase.execute({
      episodeId: 'episode-1',
      revisionId: 'rev-1',
      userId: 'user-1',
    });

    expect(episodeRepo.createRevision).toHaveBeenCalledWith({
      episodeId: 'episode-1',
      title: 'Live title',
      content: 'live text',
      order: 2,
      cast: ['Ari'],
    });
    expect(episodeRepo.pruneRevisions).toHaveBeenCalledWith(
      'episode-1',
      MAX_REVISIONS_PER_EPISODE,
    );
  });

  it('writes the revision back onto the episode', async () => {
    await useCase.execute({
      episodeId: 'episode-1',
      revisionId: 'rev-1',
      userId: 'user-1',
    });

    expect(episodeRepo.update).toHaveBeenCalledWith('episode-1', {
      title: 'Old title',
      content: 'old text',
      order: 1,
      cast: ['Bo'],
    });
  });

  it('does not snapshot before failing on a foreign revision', async () => {
    episodeRepo.findRevision.mockResolvedValue(makeRevision('episode-2'));

    await expect(
      useCase.execute({
        episodeId: 'episode-1',
        revisionId: 'rev-1',
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(DomainNotFoundError);

    expect(episodeRepo.createRevision).not.toHaveBeenCalled();
    expect(episodeRepo.update).not.toHaveBeenCalled();
  });

  it('reports a revision that does not exist as not found', async () => {
    episodeRepo.findRevision.mockResolvedValue(null);

    await expect(
      useCase.execute({
        episodeId: 'episode-1',
        revisionId: 'rev-missing',
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(DomainNotFoundError);
  });

  it('refuses when the caller does not own the episode', async () => {
    ensureEpisodeOwnership.execute.mockRejectedValue(
      new DomainForbiddenError(),
    );

    await expect(
      useCase.execute({
        episodeId: 'episode-1',
        revisionId: 'rev-1',
        userId: 'user-2',
      }),
    ).rejects.toBeInstanceOf(DomainForbiddenError);

    expect(episodeRepo.findRevision).not.toHaveBeenCalled();
  });
});
