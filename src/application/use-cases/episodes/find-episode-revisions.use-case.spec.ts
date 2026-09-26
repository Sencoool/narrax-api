import { FindEpisodeRevisionsUseCase } from './find-episode-revisions.use-case';
import { DomainForbiddenError } from '../../../domain/errors/domain-errors.js';

describe('FindEpisodeRevisionsUseCase', () => {
  const episodeRepo = { findRevisions: jest.fn() };
  const ensureEpisodeOwnership = { execute: jest.fn() };
  const useCase = new FindEpisodeRevisionsUseCase(
    episodeRepo as never,
    ensureEpisodeOwnership as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    ensureEpisodeOwnership.execute.mockResolvedValue(undefined);
  });

  it('returns the snapshots the repository holds', async () => {
    const revisions = [{ id: 'rev-2' }, { id: 'rev-1' }];
    episodeRepo.findRevisions.mockResolvedValue(revisions);

    await expect(useCase.execute('episode-1', 'user-1')).resolves.toBe(
      revisions,
    );
    expect(episodeRepo.findRevisions).toHaveBeenCalledWith('episode-1');
  });

  it('refuses to list the history of an episode the caller does not own', async () => {
    ensureEpisodeOwnership.execute.mockRejectedValue(
      new DomainForbiddenError(),
    );

    await expect(useCase.execute('episode-1', 'user-2')).rejects.toBeInstanceOf(
      DomainForbiddenError,
    );
    expect(episodeRepo.findRevisions).not.toHaveBeenCalled();
  });
});
