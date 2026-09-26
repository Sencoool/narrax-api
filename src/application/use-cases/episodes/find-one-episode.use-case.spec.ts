import { FindOneEpisodeUseCase } from './find-one-episode.use-case';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import { NovelEntity } from '../../../domain/entities/novel.entity.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

function makeEpisode(isPublished: boolean) {
  return new EpisodeEntity({
    id: 'episode-1',
    novelId: 'novel-1',
    title: 'Episode',
    content: 'text',
    episodeSummary: null,
    order: 1,
    isPublished,
    cast: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeNovel(status: 'draft' | 'published', authorId = 'author-1') {
  return new NovelEntity({
    id: 'novel-1',
    title: 'Novel',
    summary: null,
    status,
    authorId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('FindOneEpisodeUseCase visibility', () => {
  const episodeRepo = { findById: jest.fn() };
  const novelRepo = { findById: jest.fn() };
  const useCase = new FindOneEpisodeUseCase(
    episodeRepo as never,
    novelRepo as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    novelRepo.findById.mockResolvedValue(makeNovel('published'));
  });

  it('returns a published episode of a published novel to anyone', async () => {
    episodeRepo.findById.mockResolvedValue(makeEpisode(true));

    await expect(useCase.execute('episode-1')).resolves.toBeInstanceOf(
      EpisodeEntity,
    );
  });

  it('hides an unpublished episode from an anonymous reader', async () => {
    episodeRepo.findById.mockResolvedValue(makeEpisode(false));

    await expect(useCase.execute('episode-1')).rejects.toBeInstanceOf(
      DomainNotFoundError,
    );
  });

  it('hides an episode of a draft novel even when the episode is flagged published', async () => {
    episodeRepo.findById.mockResolvedValue(makeEpisode(true));
    novelRepo.findById.mockResolvedValue(makeNovel('draft'));

    await expect(
      useCase.execute('episode-1', { id: 'stranger' }),
    ).rejects.toBeInstanceOf(DomainNotFoundError);
  });

  it('returns an unpublished draft to the novel\u2019s author', async () => {
    episodeRepo.findById.mockResolvedValue(makeEpisode(false));
    novelRepo.findById.mockResolvedValue(makeNovel('draft'));

    await expect(
      useCase.execute('episode-1', { id: 'author-1' }),
    ).resolves.toBeInstanceOf(EpisodeEntity);
  });

  it('still reports a missing episode as not found', async () => {
    episodeRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('episode-1')).rejects.toBeInstanceOf(
      DomainNotFoundError,
    );
    expect(novelRepo.findById).not.toHaveBeenCalled();
  });
});
