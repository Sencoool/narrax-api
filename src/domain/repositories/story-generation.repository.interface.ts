export interface GenerationRecord {
  id: string;
  novelId: string | null;
  sourceEpisodeId: string | null;
  prompt: string;
  systemPrompt: string | null;
  contextSnapshot: unknown;
  provider: string;
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
  durationMs: number | null;
  status: string;
  output: string | null;
  error: string | null;
  createdAt: Date;
}

export interface IStoryGenerationRepository {
  findById(id: string): Promise<GenerationRecord | null>;
  findByEpisodeId(episodeId: string): Promise<GenerationRecord[]>;
}

export const STORY_GENERATION_REPOSITORY = Symbol('IStoryGenerationRepository');
