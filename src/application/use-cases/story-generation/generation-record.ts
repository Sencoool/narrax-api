import type { SimilarChunk } from '../../../domain/repositories/episode-chunk.repository.interface.js';
import type { ConversationTurn } from '../../../story-generation/dto/stream-generation.dto.js';

/** Characters kept per chunk and per history turn. Enough to recognise it, small
 *  enough that a trace row stays cheap. The full text the model received is in
 *  `systemPrompt` and `prompt`, so this only has to index it. */
const PREVIEW_CHARS = 200;

/** Mirrors the cap the prompt builder applies to the conversation prefix. */
const MAX_HISTORY_TURNS = 10;

export type GenerationMode = 'single-shot' | 'segmented';

/**
 * The structured index of what a generation was given: where each retrieved chunk
 * came from and how close it was, which lore sections made it in, and how much
 * history was sent.
 *
 * The reason this exists: with a local model, "the writing is bad" and "retrieval
 * returned nothing" look identical from the outside. This is the difference.
 */
export interface GenerationContextSnapshot {
  mode: GenerationMode;
  targetChars: number;
  contextChars: number;
  sections: string[];
  /** Whether the embedding search ran at all. False means it silently degraded. */
  embeddingAvailable: boolean;
  chunks: {
    episodeId: string;
    episodeTitle: string | null;
    distance: number;
    chars: number;
    preview: string;
  }[];
  history: {
    turnsSent: number;
    turns: { role: string; preview: string }[];
  };
  /** Only present for a segmented run: how many prompts were sent. */
  segments?: number;
  contextTokens?: number;
  estimatedInputTokens?: number;
  reservedOutputTokens?: number;
  storyCharsSent?: number;
}

export interface GenerationRecordInput {
  novelId: string;
  episodeId?: string;
  prompt: string;
  systemPrompt: string;
  provider: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  contextSnapshot: GenerationContextSnapshot;
}

/**
 * The row written when a generation starts. Kept as a pure function so the shape
 * can be asserted without a database and the streaming use case stays readable.
 */
export function buildGenerationRecord(input: GenerationRecordInput) {
  return {
    novelId: input.novelId,
    sourceEpisodeId: input.episodeId ?? null,
    prompt: input.prompt,
    systemPrompt: input.systemPrompt,
    provider: input.provider,
    model: input.model ?? null,
    temperature: input.temperature ?? null,
    maxTokens: input.maxTokens ?? null,
    contextSnapshot: input.contextSnapshot,
    status: 'processing' as const,
  };
}

export function buildContextSnapshot(input: {
  mode: GenerationMode;
  targetChars: number;
  contextChars: number;
  sections: string[];
  embeddingAvailable: boolean;
  chunks: SimilarChunk[];
  history?: ConversationTurn[];
  segments?: number;
  contextTokens?: number;
  estimatedInputTokens?: number;
  reservedOutputTokens?: number;
  storyCharsSent?: number;
}): GenerationContextSnapshot {
  const turns = (input.history ?? []).slice(-MAX_HISTORY_TURNS);

  return {
    mode: input.mode,
    targetChars: input.targetChars,
    contextChars: input.contextChars,
    sections: input.sections,
    embeddingAvailable: input.embeddingAvailable,
    chunks: input.chunks.map((chunk) => ({
      episodeId: chunk.episodeId,
      episodeTitle: chunk.episodeTitle,
      distance: chunk.distance,
      chars: chunk.content.length,
      preview: chunk.content.slice(0, PREVIEW_CHARS),
    })),
    history: {
      turnsSent: turns.length,
      turns: turns.map((turn) => ({
        role: turn.role,
        preview: turn.content.slice(0, PREVIEW_CHARS),
      })),
    },
    ...(input.segments ? { segments: input.segments } : {}),
    ...(input.contextTokens ? { contextTokens: input.contextTokens } : {}),
    ...(input.estimatedInputTokens !== undefined
      ? { estimatedInputTokens: input.estimatedInputTokens }
      : {}),
    ...(input.reservedOutputTokens
      ? { reservedOutputTokens: input.reservedOutputTokens }
      : {}),
    ...(input.storyCharsSent !== undefined
      ? { storyCharsSent: input.storyCharsSent }
      : {}),
  };
}
