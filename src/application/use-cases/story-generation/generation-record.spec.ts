import {
  buildContextSnapshot,
  buildGenerationRecord,
} from './generation-record.js';

describe('buildGenerationRecord', () => {
  it('captures the parameters that decided the answer', () => {
    const contextSnapshot = buildContextSnapshot({
      mode: 'single-shot',
      targetChars: 2_500,
      contextChars: 120,
      sections: ['ตัวละครหลัก'],
      embeddingAvailable: true,
      chunks: [],
    });

    const record = buildGenerationRecord({
      novelId: 'novel-1',
      episodeId: 'episode-1',
      prompt: 'continue the scene',
      systemPrompt: 'you are a novelist',
      provider: 'ollama',
      model: 'qwen2.5',
      temperature: 0.6,
      maxTokens: 2500,
      contextSnapshot,
    });

    expect(record).toEqual({
      novelId: 'novel-1',
      sourceEpisodeId: 'episode-1',
      prompt: 'continue the scene',
      systemPrompt: 'you are a novelist',
      provider: 'ollama',
      model: 'qwen2.5',
      temperature: 0.6,
      maxTokens: 2500,
      contextSnapshot,
      status: 'processing',
    });
  });

  it('tolerates a generation with no episode and no optional parameters', () => {
    const record = buildGenerationRecord({
      novelId: 'novel-1',
      prompt: 'p',
      systemPrompt: 's',
      provider: 'ollama',
      contextSnapshot: buildContextSnapshot({
        mode: 'single-shot',
        targetChars: 1,
        contextChars: 0,
        sections: [],
        embeddingAvailable: false,
        chunks: [],
      }),
    });

    expect(record.sourceEpisodeId).toBeNull();
    expect(record.model).toBeNull();
    expect(record.temperature).toBeNull();
    expect(record.maxTokens).toBeNull();
  });
});

describe('buildContextSnapshot', () => {
  const chunk = (id: string, content = 'some retrieved prose') => ({
    content,
    episodeId: id,
    episodeTitle: `Episode ${id}`,
    distance: 0.42,
  });

  it('records where each retrieved chunk came from and how close it was', () => {
    const snapshot = buildContextSnapshot({
      mode: 'single-shot',
      targetChars: 2_500,
      contextChars: 900,
      sections: ['ตัวละครหลัก', 'เนื้อเรื่องที่เกี่ยวข้อง'],
      embeddingAvailable: true,
      chunks: [chunk('a'), chunk('b')],
    });

    expect(snapshot.chunks).toEqual([
      {
        episodeId: 'a',
        episodeTitle: 'Episode a',
        distance: 0.42,
        chars: 'some retrieved prose'.length,
        preview: 'some retrieved prose',
      },
      {
        episodeId: 'b',
        episodeTitle: 'Episode b',
        distance: 0.42,
        chars: 'some retrieved prose'.length,
        preview: 'some retrieved prose',
      },
    ]);
    expect(snapshot.sections).toHaveLength(2);
    expect(snapshot.embeddingAvailable).toBe(true);
  });

  it('flags the case where retrieval never ran, which is what a bad answer hides behind', () => {
    const snapshot = buildContextSnapshot({
      mode: 'single-shot',
      targetChars: 2_500,
      contextChars: 0,
      sections: [],
      embeddingAvailable: false,
      chunks: [],
    });

    expect(snapshot.embeddingAvailable).toBe(false);
    expect(snapshot.chunks).toEqual([]);
  });

  it('keeps only the last ten history turns, and previews rather than whole turns', () => {
    const history = Array.from({ length: 14 }, (_, index) => ({
      role: 'user' as const,
      content: `turn ${index} `.repeat(40),
    }));

    const snapshot = buildContextSnapshot({
      mode: 'single-shot',
      targetChars: 2_500,
      contextChars: 10,
      sections: [],
      embeddingAvailable: true,
      chunks: [],
      history,
    });

    expect(snapshot.history.turnsSent).toBe(10);
    expect(snapshot.history.turns[0]?.preview.length).toBe(200);
    expect(snapshot.history.turns[9]?.preview).toContain('turn 13');
  });

  it('notes the segment count on a segmented run, and omits it otherwise', () => {
    const base = {
      targetChars: 9_000,
      contextChars: 10,
      sections: [],
      embeddingAvailable: true,
      chunks: [],
    };

    expect(
      buildContextSnapshot({ ...base, mode: 'segmented', segments: 4 })
        .segments,
    ).toBe(4);
    expect(
      buildContextSnapshot({ ...base, mode: 'single-shot' }).segments,
    ).toBeUndefined();
  });
});
