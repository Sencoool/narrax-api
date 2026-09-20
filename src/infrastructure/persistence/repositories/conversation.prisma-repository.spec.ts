import { PrismaConversationRepository } from './conversation.prisma-repository.js';

/**
 * Regression guard for the conversation-history window.
 *
 * The query must return the NEWEST `limit` messages in chronological order.
 * Ordering ascending and taking the first N returns the oldest messages, so a
 * long conversation would never surface the recent turns to the AI.
 */
describe('PrismaConversationRepository.findByEpisodeId', () => {
  const episodeId = 'episode-1';

  function row(id: string, createdAt: Date) {
    return {
      id,
      episodeId,
      role: 'user',
      content: `message ${id}`,
      status: 'done',
      createdAt,
    };
  }

  it('asks the database for the newest messages, newest first', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repo = new PrismaConversationRepository({
      conversationMessage: { findMany },
    } as never);

    await repo.findByEpisodeId(episodeId, 50);

    expect(findMany).toHaveBeenCalledWith({
      where: { episodeId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
  });

  it('returns the page in chronological order even though the query is desc', async () => {
    const newest = row('c', new Date('2026-01-03T00:00:00Z'));
    const middle = row('b', new Date('2026-01-02T00:00:00Z'));
    const oldest = row('a', new Date('2026-01-01T00:00:00Z'));

    // What Postgres hands back for ORDER BY createdAt DESC
    const findMany = jest.fn().mockResolvedValue([newest, middle, oldest]);
    const repo = new PrismaConversationRepository({
      conversationMessage: { findMany },
    } as never);

    const result = await repo.findByEpisodeId(episodeId);

    expect(result.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(result[0].content).toBe('message a');
  });

  it('defaults to a 50 message window', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repo = new PrismaConversationRepository({
      conversationMessage: { findMany },
    } as never);

    await repo.findByEpisodeId(episodeId);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });
});
