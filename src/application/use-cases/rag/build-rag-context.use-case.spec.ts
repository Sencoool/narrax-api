import { BuildRagContextUseCase } from './build-rag-context.use-case.js';

describe('BuildRagContextUseCase', () => {
  const novelRepo = {
    findContext: jest.fn().mockResolvedValue({
      characters: JSON.stringify([{ name: 'Ari', role: 'protagonist' }]),
      worldBuilding: 'A floating city',
      plotOutline: null,
      writingStyle: 'Lyrical',
    }),
  };
  const chunkRepo = {
    findSimilar: jest.fn().mockResolvedValue([
      {
        content: 'chunk one',
        episodeId: 'episode-1',
        episodeTitle: 'Episode 1',
        distance: 0.2,
      },
    ]),
  };
  const ai = { generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2]) };
  const characters = {
    listBoard: jest.fn().mockResolvedValue({ characters: [], factions: [] }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    characters.listBoard.mockResolvedValue({ characters: [], factions: [] });
  });

  it('returns chunk context when embeddings work', async () => {
    const useCase = new BuildRagContextUseCase(
      novelRepo as never,
      chunkRepo as never,
      ai as never,
      characters as never,
    );
    const result = await useCase.execute('novel-1', 'query');
    expect(result.contextString).toContain('chunk one');
    expect(result.writingStyle).toBe('Lyrical');
  });

  it('still returns novel context when the embedding provider is down', async () => {
    ai.generateEmbedding.mockRejectedValueOnce(
      new Error('connect ECONNREFUSED'),
    );
    const useCase = new BuildRagContextUseCase(
      novelRepo as never,
      chunkRepo as never,
      ai as never,
      characters as never,
    );
    const result = await useCase.execute('novel-1', 'query');
    expect(result.contextString).toContain('A floating city');
    expect(result.contextString).not.toContain('chunk one');
    expect(chunkRepo.findSimilar).not.toHaveBeenCalled();
  });

  it('withholds unintroduced characters and factions from the prompt', async () => {
    characters.listBoard.mockResolvedValue({
      characters: [
        {
          id: 'c1',
          name: 'Ari',
          role: 'protagonist',
          description: 'keeper',
          introducedAtOrder: null,
          factionIds: ['f1'],
          factionMemberships: [{ factionId: 'f1', rank: 'captain' }],
        },
        {
          id: 'c2',
          name: 'The stranger',
          role: 'antagonist',
          description: 'secret',
          introducedAtOrder: 9,
          factionIds: ['f2'],
          factionMemberships: [{ factionId: 'f2', rank: null }],
        },
      ],
      factions: [
        { id: 'f1', name: 'Guard' },
        { id: 'f2', name: 'Hidden order' },
      ],
    });
    const useCase = new BuildRagContextUseCase(
      novelRepo as never,
      chunkRepo as never,
      ai as never,
      characters as never,
    );

    const result = await useCase.execute('novel-1', 'query', 5, undefined, 3);

    expect(result.contextString).toContain('Ari');
    expect(result.contextString).toContain('Guard: Ari (captain)');
    expect(result.contextString).not.toContain('The stranger');
    expect(result.contextString).not.toContain('Hidden order');
  });

  it('applies the episode cast to rows and the legacy blob', async () => {
    characters.listBoard.mockResolvedValueOnce({
      characters: [
        {
          id: 'c1',
          name: 'Ari',
          role: null,
          description: null,
          introducedAtOrder: null,
          factionIds: [],
          factionMemberships: [],
        },
        {
          id: 'c2',
          name: 'Bela',
          role: null,
          description: null,
          introducedAtOrder: null,
          factionIds: [],
          factionMemberships: [],
        },
      ],
      factions: [],
    });
    const useCase = new BuildRagContextUseCase(
      novelRepo as never,
      chunkRepo as never,
      ai as never,
      characters as never,
    );

    const rows = await useCase.execute('novel-1', 'query', 5, ['Bela'], 1);
    const legacy = await useCase.execute('novel-1', 'query', 5, ['Missing'], 1);

    expect(rows.contextString).toContain('Bela');
    expect(rows.contextString).not.toContain('Ari');
    expect(legacy.contextString).not.toContain('Ari');
  });
});
