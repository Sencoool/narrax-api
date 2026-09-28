import {
  DomainForbiddenError,
  DomainValidationError,
} from '../../../domain/errors/domain-errors.js';
import { SuggestStorylinesUseCase } from './suggest-storylines.use-case.js';

describe('SuggestStorylinesUseCase', () => {
  const novels = { findById: jest.fn() };
  const episodes = {
    findById: jest.fn(),
    findByNovelId: jest.fn(),
    findLastOrderByNovelId: jest.fn(),
  };
  const ai = { generate: jest.fn() };
  const context = { execute: jest.fn() };
  const useCase = new SuggestStorylinesUseCase(
    novels as never,
    episodes as never,
    ai as never,
    context as never,
  );
  const input = { novelId: 'novel-1', userId: 'me', episodeId: 'episode-3' };

  beforeEach(() => {
    jest.resetAllMocks();
    novels.findById.mockResolvedValue({
      title: 'Novel',
      summary: null,
      isOwnedBy: () => true,
    });
    episodes.findById.mockResolvedValue({
      novelId: 'novel-1',
      order: 3,
      cast: [],
      contentTail: () => 'current tail',
    });
    episodes.findByNovelId.mockResolvedValue([
      { order: 1, episodeSummary: 'summary one' },
      { order: 2, episodeSummary: 'summary two' },
      { order: 4, episodeSummary: 'future spoiler' },
    ]);
    context.execute.mockResolvedValue({
      contextString: 'Visible: Mali',
      writingStyle: null,
    });
  });

  it('parses three suggestions in a fenced code block and omits future episode summaries', async () => {
    ai.generate.mockResolvedValue(
      '```json\n[{"title":"a","prompt":"p1"},{"title":"b","prompt":"p2"},{"title":"c","prompt":"p3"}]\n```',
    );

    await expect(useCase.execute(input)).resolves.toEqual([
      { title: 'a', prompt: 'p1' },
      { title: 'b', prompt: 'p2' },
      { title: 'c', prompt: 'p3' },
    ]);
    expect(context.execute).toHaveBeenCalledWith(
      'novel-1',
      'current tail',
      5,
      [],
      3,
    );
    const [systemPrompt, userMessage] = ai.generate.mock.calls[0] as string[];
    expect(systemPrompt).toContain('Visible: Mali');
    expect(userMessage).toContain('summary two');
    expect(userMessage).not.toContain('future spoiler');
  });

  it('retries once and fails when the model returns invalid JSON', async () => {
    ai.generate.mockResolvedValue('ขอโทษครับ');
    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      DomainValidationError,
    );
    expect(ai.generate).toHaveBeenCalledTimes(2);
  });

  it('rejects another writer before asking the model', async () => {
    novels.findById.mockResolvedValue({ isOwnedBy: () => false });
    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      DomainForbiddenError,
    );
    expect(ai.generate).not.toHaveBeenCalled();
  });
});
