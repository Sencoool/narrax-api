import { UpsertNovelContextUseCase } from './upsert-novel-context.use-case';
import type { UpsertNovelContextData } from '../../../domain/repositories/novel.repository.interface.js';
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
    status: 'draft',
    authorId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('UpsertNovelContextUseCase nullability', () => {
  const upsertContext = jest.fn<
    Promise<never>,
    [string, UpsertNovelContextData]
  >();
  const novelRepo = { findById: jest.fn(), upsertContext };
  const useCase = new UpsertNovelContextUseCase(novelRepo as never);

  beforeEach(() => {
    jest.clearAllMocks();
    novelRepo.findById.mockResolvedValue(makeNovel());
    upsertContext.mockResolvedValue({} as never);
  });

  /** `toStrictEqual`, because `toEqual` treats an undefined key as absent — and
   *  undefined-versus-null is the whole point of these tests. */
  const dataPassedToRepo = (): UpsertNovelContextData =>
    upsertContext.mock.calls[0][1];

  it('passes null through so the column is cleared', async () => {
    await useCase.execute('novel-1', 'author-1', { worldBuilding: null });

    expect(dataPassedToRepo()).toStrictEqual({
      characters: undefined,
      worldBuilding: null,
      plotOutline: undefined,
      writingStyle: undefined,
    });
  });

  it('keeps omitted fields undefined so they are left untouched', async () => {
    await useCase.execute('novel-1', 'author-1', { writingStyle: 'terse' });

    expect(dataPassedToRepo()).toStrictEqual({
      characters: undefined,
      worldBuilding: undefined,
      plotOutline: undefined,
      writingStyle: 'terse',
    });
  });

  it('does not turn an omission into a clear', async () => {
    await useCase.execute('novel-1', 'author-1', {});

    const data = dataPassedToRepo() as Record<string, unknown>;
    for (const key of [
      'characters',
      'worldBuilding',
      'plotOutline',
      'writingStyle',
    ]) {
      expect(data[key]).toBeUndefined();
    }
  });

  it('passes an explicit clear and an update in the same call', async () => {
    await useCase.execute('novel-1', 'author-1', {
      characters: null,
      plotOutline: 'a new plan',
    });

    expect(dataPassedToRepo()).toStrictEqual({
      characters: null,
      worldBuilding: undefined,
      plotOutline: 'a new plan',
      writingStyle: undefined,
    });
  });

  it('still refuses a writer who does not own the novel', async () => {
    novelRepo.findById.mockResolvedValue(makeNovel('someone-else'));

    await expect(
      useCase.execute('novel-1', 'author-1', { worldBuilding: null }),
    ).rejects.toBeInstanceOf(DomainForbiddenError);
    expect(novelRepo.upsertContext).not.toHaveBeenCalled();
  });

  it('still reports a missing novel as not found', async () => {
    novelRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('novel-1', 'author-1', { worldBuilding: null }),
    ).rejects.toBeInstanceOf(DomainNotFoundError);
  });
});
