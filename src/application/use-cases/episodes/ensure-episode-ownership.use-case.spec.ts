import { EnsureEpisodeOwnershipUseCase } from './ensure-episode-ownership.use-case.js';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import { NovelEntity } from '../../../domain/entities/novel.entity.js';
import {
  DomainForbiddenError,
  DomainNotFoundError,
} from '../../../domain/errors/domain-errors.js';

function makeEpisode(novelId = 'novel-1') {
  return new EpisodeEntity({
    id: 'episode-1',
    novelId,
    title: 'Episode',
    content: '',
    episodeSummary: null,
    order: 1,
    isPublished: false,
    cast: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeNovel(authorId: string) {
  return new NovelEntity({
    id: 'novel-1',
    title: 'Novel',
    summary: null,
    status: 'draft',
    authorId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('EnsureEpisodeOwnershipUseCase', () => {
  const episodeRepo = { findById: jest.fn() };
  const novelRepo = { findById: jest.fn() };
  const useCase = new EnsureEpisodeOwnershipUseCase(
    episodeRepo as never,
    novelRepo as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves the episode when the caller owns the parent novel', async () => {
    const episode = makeEpisode();
    episodeRepo.findById.mockResolvedValue(episode);
    novelRepo.findById.mockResolvedValue(makeNovel('user-1'));

    await expect(useCase.execute('episode-1', 'user-1')).resolves.toBe(episode);
  });

  it('rejects another user with a forbidden error', async () => {
    episodeRepo.findById.mockResolvedValue(makeEpisode());
    novelRepo.findById.mockResolvedValue(makeNovel('user-1'));

    await expect(useCase.execute('episode-1', 'user-2')).rejects.toBeInstanceOf(
      DomainForbiddenError,
    );
  });

  it('reports a missing episode as not found', async () => {
    episodeRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('episode-1', 'user-1')).rejects.toBeInstanceOf(
      DomainNotFoundError,
    );
    expect(novelRepo.findById).not.toHaveBeenCalled();
  });

  it('reports a missing parent novel as not found', async () => {
    episodeRepo.findById.mockResolvedValue(makeEpisode());
    novelRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('episode-1', 'user-1')).rejects.toBeInstanceOf(
      DomainNotFoundError,
    );
  });
});
