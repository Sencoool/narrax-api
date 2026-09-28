import { estimateTokens, fitContextBudget } from './context-budget.js';

describe('context budget', () => {
  it('estimates Thai conservatively and never assigns zero to text', () => {
    expect(estimateTokens('สวัสดีครับ')).toBeGreaterThanOrEqual(4);
    expect(estimateTokens('a')).toBe(1);
  });

  it('drops old history, then context, then the start of the story', () => {
    const result = fitContextBudget({
      sections: ['c'.repeat(300)],
      history: ['old'.repeat(100), 'new'.repeat(100)],
      story: 's'.repeat(900),
      contextTokens: 200,
      reserveTokens: 50,
      buildPrompts: (context, history, story) => [
        context + history.join('') + story,
      ],
    });
    expect(result.history).toEqual([]);
    expect(result.context).toBe('');
    expect(result.story.length).toBeLessThan(900);
    expect(result.inputTokens).toBeLessThanOrEqual(150);
  });

  it('fails when the required instruction exceeds the window', () => {
    expect(() =>
      fitContextBudget({
        sections: [],
        history: [],
        story: '',
        contextTokens: 512,
        reserveTokens: 256,
        buildPrompts: () => ['ก'.repeat(300)],
      }),
    ).toThrow('increase');
  });
});
