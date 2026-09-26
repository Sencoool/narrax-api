import { PrismaNovelRepository } from './novel.prisma-repository';

/**
 * These cases exist because every novel, including unpublished drafts, used to be
 * listable by anyone. The assertion is on the WHERE clause, not on the returned
 * rows: visibility has to be applied by the database or pagination can leak.
 */
describe('PrismaNovelRepository.findAll visibility', () => {
  const prisma = { novel: { findMany: jest.fn(), count: jest.fn() } };
  const repo = new PrismaNovelRepository(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.novel.findMany.mockResolvedValue([]);
    prisma.novel.count.mockResolvedValue(0);
  });

  it('shows an anonymous caller only published novels', async () => {
    await repo.findAll({ page: 1, limit: 20 });

    expect(prisma.novel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ status: 'published' }] },
      }),
    );
  });

  it("adds a signed-in caller's own drafts", async () => {
    await repo.findAll({ page: 1, limit: 20, includeDraftsFor: 'user-1' });

    expect(prisma.novel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ OR: [{ status: 'published' }, { authorId: 'user-1' }] }],
        },
      }),
    );
  });

  it('cannot be tricked into listing every draft by asking for drafts', async () => {
    await repo.findAll({ page: 1, limit: 20, status: 'draft' });

    expect(prisma.novel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ status: 'published' }, { status: 'draft' }] },
      }),
    );
  });

  it('keeps a foreign authorId readable but still limited to published work', async () => {
    await repo.findAll({ page: 1, limit: 20, authorId: 'someone-else' });

    expect(prisma.novel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ status: 'published' }, { authorId: 'someone-else' }],
        },
      }),
    );
  });
});
