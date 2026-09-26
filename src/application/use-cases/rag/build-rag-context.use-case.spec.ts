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
  const chunkRepo = { findSimilar: jest.fn().mockResolvedValue(['chunk one']) };
  const ai = { generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2]) };

  beforeEach(() => jest.clearAllMocks());

  it('returns chunk context when embeddings work', async () => {
    const useCase = new BuildRagContextUseCase(
      novelRepo as never,
      chunkRepo as never,
      ai as never,
    );
    const result = await useCase.execute('novel-1', 'query');
    expect(result.contextString).toContain('chunk one');
    expect(result.writingStyle).toBe('Lyrical');
  });

  it('still returns novel context when the embedding provider is down', async () => {
    ai.generateEmbedding.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const useCase = new BuildRagContextUseCase(
      novelRepo as never,
      chunkRepo as never,
      ai as never,
    );
    const result = await useCase.execute('novel-1', 'query');
    expect(result.contextString).toContain('A floating city');
    expect(result.contextString).not.toContain('chunk one');
    expect(chunkRepo.findSimilar).not.toHaveBeenCalled();
  });
});
