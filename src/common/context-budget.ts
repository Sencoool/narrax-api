export const DEFAULT_CONTEXT_TOKENS = 8192;

/** A deliberately conservative estimate for Thai text. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const thai = (text.match(/[\u0e00-\u0e7f]/g) ?? []).length;
  return Math.max(1, thai + Math.ceil((text.length - thai) / 3));
}

export interface BudgetedPrompt<T> {
  context: string;
  history: T[];
  story: string;
  inputTokens: number;
  droppedHistory: number;
  droppedSections: number;
  trimmedStoryChars: number;
}

/** Fit the exact prompts sent to a provider, keeping recent story and instructions. */
export function fitContextBudget<T>(options: {
  sections: string[];
  history: T[];
  story: string;
  contextTokens: number;
  reserveTokens: number;
  buildPrompts: (context: string, history: T[], story: string) => string[];
}): BudgetedPrompt<T> {
  const history = [...options.history];
  const sections = [...options.sections];
  let story = options.story;
  const limit = options.contextTokens - options.reserveTokens;
  const used = () =>
    Math.max(
      ...options
        .buildPrompts(sections.join('\n\n'), history, story)
        .map(estimateTokens),
    );
  let droppedHistory = 0;
  let droppedSections = 0;
  while (used() > limit && history.length) {
    history.shift();
    droppedHistory++;
  }
  while (used() > limit && sections.length) {
    sections.pop();
    droppedSections++;
  }
  if (used() > limit && story) {
    let low = 0;
    let high = story.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const candidate = story.slice(-mid);
      const cost = Math.max(
        ...options.buildPrompts('', [], candidate).map(estimateTokens),
      );
      if (cost <= limit) low = mid;
      else high = mid - 1;
    }
    story = low ? story.slice(-low) : '';
  }
  const inputTokens = used();
  if (inputTokens > limit) {
    throw new Error(
      `Prompt needs ${inputTokens} tokens; increase the ${options.contextTokens}-token context window or shorten the current instruction`,
    );
  }
  return {
    context: sections.join('\n\n'),
    history,
    story,
    inputTokens,
    droppedHistory,
    droppedSections,
    trimmedStoryChars: options.story.length - story.length,
  };
}
