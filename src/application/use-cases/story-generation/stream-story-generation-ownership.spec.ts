import { DomainForbiddenError } from '../../../domain/errors/domain-errors.js';
import { StreamStoryGenerationUseCase } from './stream-story-generation.use-case.js';

describe('StreamStoryGenerationUseCase ownership', () => {
  const ai = { stream: jest.fn() };
  const novels = { findById: jest.fn() };
  const episodes = {
    findById: jest.fn(),
    findLastOrderByNovelId: jest.fn(),
  };
  const context = { execute: jest.fn() };
  const multiProvider = { stream: jest.fn() };
  const persistence = { createRequest: jest.fn(), updateRequest: jest.fn() };
  const useCase = new StreamStoryGenerationUseCase(
    ai as never,
    novels as never,
    episodes as never,
    context as never,
    multiProvider as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects a novel owned by another writer before loading its context', async () => {
    novels.findById.mockResolvedValue({ isOwnedBy: () => false });

    await expect(
      useCase.execute(
        { novelId: 'foreign-novel', userId: 'writer', userMessage: 'continue' },
        jest.fn(),
        persistence,
      ),
    ).rejects.toBeInstanceOf(DomainForbiddenError);
    expect(episodes.findById).not.toHaveBeenCalled();
    expect(context.execute).not.toHaveBeenCalled();
  });

  it('rejects an episode from a different novel', async () => {
    novels.findById.mockResolvedValue({ isOwnedBy: () => true });
    episodes.findById.mockResolvedValue({ novelId: 'foreign-novel' });

    await expect(
      useCase.execute(
        {
          novelId: 'owned-novel',
          episodeId: 'foreign-episode',
          userId: 'writer',
          userMessage: 'continue',
        },
        jest.fn(),
        persistence,
      ),
    ).rejects.toBeInstanceOf(DomainForbiddenError);
    expect(context.execute).not.toHaveBeenCalled();
  });
});
