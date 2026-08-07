import type { GenerationStatusValue } from '../value-objects/generation-status.vo.js';

export interface StoryGenerationRequestProps {
  id: string;
  novelId: string | null;
  sourceEpisodeId: string | null;
  prompt: string;
  status: GenerationStatusValue;
  provider: string;
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
  output: string | null;
  error: string | null;
  externalJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * StoryGenerationRequest domain entity.
 *
 * Represents a single AI story-generation job — from the initial HTTP request
 * through to the final streamed output saved in `output`.
 *
 * Business rules:
 * - Once the request reaches a terminal state (completed / failed / canceled),
 *   no further status transitions should occur.
 * - `output` is only meaningful when status === 'completed'.
 * - `error` is only meaningful when status === 'failed'.
 */
export class StoryGenerationRequestEntity {
  readonly id: string;
  readonly novelId: string | null;
  readonly sourceEpisodeId: string | null;
  readonly prompt: string;
  readonly status: GenerationStatusValue;
  readonly provider: string;
  readonly model: string | null;
  readonly temperature: number | null;
  readonly maxTokens: number | null;
  readonly output: string | null;
  readonly error: string | null;
  readonly externalJobId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: StoryGenerationRequestProps) {
    this.id = props.id;
    this.novelId = props.novelId;
    this.sourceEpisodeId = props.sourceEpisodeId;
    this.prompt = props.prompt;
    this.status = props.status;
    this.provider = props.provider;
    this.model = props.model;
    this.temperature = props.temperature;
    this.maxTokens = props.maxTokens;
    this.output = props.output;
    this.error = props.error;
    this.externalJobId = props.externalJobId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isTerminal(): boolean {
    return (
      this.status === 'completed' ||
      this.status === 'failed' ||
      this.status === 'canceled'
    );
  }

  isSuccessful(): boolean {
    return this.status === 'completed' && this.output !== null;
  }

  outputLength(): number {
    return this.output?.length ?? 0;
  }
}
