import { FindOneNovelUseCase } from './find-one-novel.use-case';
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

describe('FindOneNovelUseCase visibility', () => {
  const novelRepo = { findById: jest.fn() };
  const useCase = new FindOneNovelUseCase(novelRepo as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns a published novel to an anonymous reader', async () => {
    novelRepo.findById.mockResolvedValue(makeNovel('published'));

    await expect(useCase.execute('novel-1')).resolves.toBeInstanceOf(
      NovelEntity,
    );
  });

  it('hides a draft from an anonymous reader as not found', async () => {
    novelRepo.findById.mockResolvedValue(makeNovel('draft'));

    await expect(useCase.execute('novel-1')).rejects.toBeInstanceOf(
      DomainNotFoundError,
    );
  });

  it('hides a draft from a signed-in stranger', async () => {
    novelRepo.findById.mockResolvedValue(makeNovel('draft'));

    await expect(
      useCase.execute('novel-1', { id: 'stranger' }),
    ).rejects.toBeInstanceOf(DomainNotFoundError);
  });

  it('returns a draft to its author', async () => {
    novelRepo.findById.mockResolvedValue(makeNovel('draft'));

    await expect(
      useCase.execute('novel-1', { id: 'author-1' }),
    ).resolves.toBeInstanceOf(NovelEntity);
  });

  it('still reports a missing novel as not found', async () => {
    novelRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('novel-1')).rejects.toBeInstanceOf(
      DomainNotFoundError,
    );
  });
});
