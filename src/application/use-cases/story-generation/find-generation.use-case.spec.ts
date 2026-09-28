import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';
import { FindGenerationUseCase } from './find-generation.use-case.js';

describe('FindGenerationUseCase', () => {
  const generations = { findById: jest.fn(), findByEpisodeId: jest.fn() };
  const novels = { findById: jest.fn() };
  const episodes = { findById: jest.fn() };
  const useCase = new FindGenerationUseCase(
    generations,
    novels as never,
    episodes as never,
  );

  beforeEach(() => jest.resetAllMocks());

  it('returns an owned generation', async () => {
    const record = { id: 'gen-1', novelId: 'novel-1', prompt: 'p' };
    generations.findById.mockResolvedValue(record);
    novels.findById.mockResolvedValue({ isOwnedBy: () => true });
    await expect(useCase.execute('gen-1', 'writer')).resolves.toBe(record);
  });

  it('hides another writer’s prompt', async () => {
    generations.findById.mockResolvedValue({ novelId: 'novel-1' });
    novels.findById.mockResolvedValue({ isOwnedBy: () => false });
    await expect(useCase.execute('gen-1', 'stranger')).rejects.toBeInstanceOf(
      DomainNotFoundError,
    );
  });

  it('hides another writer’s episode history', async () => {
    episodes.findById.mockResolvedValue({ novelId: 'novel-1' });
    novels.findById.mockResolvedValue({ isOwnedBy: () => false });
    await expect(
      useCase.listForEpisode('episode-1', 'stranger'),
    ).rejects.toBeInstanceOf(DomainNotFoundError);
    expect(generations.findByEpisodeId).not.toHaveBeenCalled();
  });
});
