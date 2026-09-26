import { FindEpisodesUseCase } from './find-episodes.use-case';
import { NovelEntity } from '../../../domain/entities/novel.entity.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

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

const summary = (id: string, isPublished: boolean) => ({
  id,
  novelId: 'novel-1',
  title: id,
  order: 1,
  isPublished,
  episodeSummary: null,
  chunkCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('FindEpisodesUseCase visibility', () => {
  const episodeRepo = { findByNovelId: jest.fn() };
  const novelRepo = { findById: jest.fn() };
  const useCase = new FindEpisodesUseCase(
    episodeRepo as never,
    novelRepo as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('shows only published episodes to a reader', async () => {
    novelRepo.findById.mockResolvedValue(makeNovel('published'));
    episodeRepo.findByNovelId.mockResolvedValue([
      summary('published-1', true),
      summary('draft-1', false),
    ]);

    const result = await useCase.execute('novel-1');

    expect(result.map((episode) => episode.id)).toEqual(['published-1']);
  });

  it('shows the whole list, drafts included, to the author', async () => {
    novelRepo.findById.mockResolvedValue(makeNovel('draft'));
    episodeRepo.findByNovelId.mockResolvedValue([
      summary('published-1', true),
      summary('draft-1', false),
    ]);

    const result = await useCase.execute('novel-1', { id: 'author-1' });

    expect(result).toHaveLength(2);
  });

  it('refuses to list episodes of a draft novel for a stranger', async () => {
    novelRepo.findById.mockResolvedValue(makeNovel('draft'));

    await expect(
      useCase.execute('novel-1', { id: 'stranger' }),
    ).rejects.toBeInstanceOf(DomainNotFoundError);
    expect(episodeRepo.findByNovelId).not.toHaveBeenCalled();
  });
});
