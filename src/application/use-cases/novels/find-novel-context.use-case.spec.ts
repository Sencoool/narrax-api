import { FindNovelContextUseCase } from './find-novel-context.use-case';
import { NovelEntity } from '../../../domain/entities/novel.entity.js';
import {
  DomainForbiddenError,
  DomainNotFoundError,
} from '../../../domain/errors/domain-errors.js';

function makeNovel(authorId = 'author-1') {
  return new NovelEntity({
    id: 'novel-1',
    title: 'Novel',
    summary: null,
    status: 'published',
    authorId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('FindNovelContextUseCase', () => {
  const novelRepo = { findById: jest.fn(), findContext: jest.fn() };
  const useCase = new FindNovelContextUseCase(novelRepo as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns the lore to the author', async () => {
    const context = { characters: '[]' };
    novelRepo.findById.mockResolvedValue(makeNovel());
    novelRepo.findContext.mockResolvedValue(context);

    await expect(useCase.execute('novel-1', 'author-1')).resolves.toBe(context);
  });

  it('refuses anyone else, even for a published novel', async () => {
    novelRepo.findById.mockResolvedValue(makeNovel());

    await expect(useCase.execute('novel-1', 'stranger')).rejects.toBeInstanceOf(
      DomainForbiddenError,
    );
    expect(novelRepo.findContext).not.toHaveBeenCalled();
  });

  it('still reports a missing novel as not found', async () => {
    novelRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('novel-1', 'author-1')).rejects.toBeInstanceOf(
      DomainNotFoundError,
    );
  });
});
