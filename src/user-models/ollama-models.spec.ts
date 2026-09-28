import { listOllamaModels } from './ollama-models.js';

describe('listOllamaModels', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps installed models to name and size', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ models: [{ name: 'qwen2.5:latest', size: 4096 }] }),
    }) as never;
    await expect(listOllamaModels('http://localhost:11434')).resolves.toEqual([
      { name: 'qwen2.5:latest', sizeBytes: 4096 },
    ]);
  });

  it('returns an empty list when Ollama is down', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as never;
    await expect(listOllamaModels('http://localhost:11434')).resolves.toEqual(
      [],
    );
  });
});
