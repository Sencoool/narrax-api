import { PrismaNovelRepository } from './novel.prisma-repository';

/**
 * The database behaviour these tests protect: on an update, Prisma skips a field
 * that is `undefined` and writes SQL NULL for a field that is `null`. The
 * repository must therefore forward both as-is — a `?? null` in the update branch
 * would turn every partial save into a wipe.
 */
describe('PrismaNovelRepository.upsertContext nullability', () => {
  const upsert = jest.fn<Promise<unknown>, [unknown]>();
  const prisma = { novelContext: { upsert } };
  const repo = new PrismaNovelRepository(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    upsert.mockResolvedValue({
      novelId: 'novel-1',
      characters: null,
      worldBuilding: null,
      plotOutline: null,
      writingStyle: null,
    });
  });

  const argsOfUpsert = () =>
    upsert.mock.calls[0][0] as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };

  it('writes NULL on update when a field is explicitly null', async () => {
    await repo.upsertContext('novel-1', { worldBuilding: null });

    expect(argsOfUpsert().update).toStrictEqual({
      characters: undefined,
      worldBuilding: null,
      plotOutline: undefined,
      writingStyle: undefined,
    });
  });

  it('leaves an omitted field undefined on update, so Prisma does not touch it', async () => {
    await repo.upsertContext('novel-1', { plotOutline: 'new plan' });

    expect(argsOfUpsert().update).toStrictEqual({
      characters: undefined,
      worldBuilding: undefined,
      plotOutline: 'new plan',
      writingStyle: undefined,
    });
  });

  it('coalesces undefined to NULL when inserting a context row for the first time', async () => {
    await repo.upsertContext('novel-1', { worldBuilding: 'a place' });

    expect(argsOfUpsert().create).toEqual({
      novelId: 'novel-1',
      characters: null,
      worldBuilding: 'a place',
      plotOutline: null,
      writingStyle: null,
    });
  });
});
