import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IEpisodeChunkRepository } from '../../../domain/repositories/episode-chunk.repository.interface.js';
import {
  EPISODE_CHUNK_REPOSITORY,
  type SimilarChunk,
} from '../../../domain/repositories/episode-chunk.repository.interface.js';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import type { IAiProvider } from '../../ports/ai-provider.port.js';
import { AI_PROVIDER } from '../../ports/ai-provider.port.js';

/** Shape of one entry in NovelContext.characters (stored as a JSON string). */
interface CastCharacter {
  name?: string;
  role?: string;
  description?: string;
}

/** The fields from NovelContext that are used to build the AI context string. */
interface NovelContextFields {
  characters: string | null;
  worldBuilding: string | null;
  plotOutline: string | null;
  writingStyle: string | null;
}

export interface ChunkRetrievalSummary {
  chunkCount: number;
  /** False when the embedding call failed and retrieval silently degraded. */
  embeddingAvailable: boolean;
  /** Which lore sections made it into the context string, in order. */
  sections: string[];
  contextChars: number;
  chunks: SimilarChunk[];
}

export interface BuildRagContextResult {
  /** The full context string to inject into the system prompt. */
  contextString: string;
  /** The writingStyle value (lifted out separately so the controller can use it directly). */
  writingStyle: string | null;
  /** What retrieval actually did — the difference between "bad model" and "no context". */
  retrieval: ChunkRetrievalSummary;
}

/**
 * Builds the full RAG context string for a novel:
 *   1. Retrieves relevant EpisodeChunks via cosine search
 *   2. Loads NovelContext metadata (characters, world, plot, style)
 *   3. Assembles them into a formatted context string
 *
 * This mirrors RagService.buildContext() and RagService.retrieveRelevantChunks().
 */
@Injectable()
export class BuildRagContextUseCase {
  private readonly logger = new Logger(BuildRagContextUseCase.name);

  private readonly COSINE_DISTANCE_THRESHOLD = 0.8;
  private readonly DEFAULT_TOP_K = 5;

  constructor(
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
    @Inject(EPISODE_CHUNK_REPOSITORY)
    private readonly chunkRepo: IEpisodeChunkRepository,
    @Inject(AI_PROVIDER)
    private readonly ai: IAiProvider,
  ) {}

  async execute(
    novelId: string,
    ragQuery: string,
    topK = this.DEFAULT_TOP_K,
    cast?: string[],
  ): Promise<BuildRagContextResult> {
    this.logger.log(
      `🏗️  [RAG:context] Building context for novelId: ${novelId}`,
    );

    // Fetch novel metadata first — it never depends on the embedding provider.
    const novelContext = await this.novelRepo.findContext(novelId);

    // Embedding is a local-Ollama dependency. If it is unavailable we degrade to
    // metadata-only context rather than failing the whole generation.
    let relevantChunks: SimilarChunk[] = [];
    let embeddingAvailable = false;
    try {
      const queryEmbedding = await this.ai.generateEmbedding(ragQuery);
      embeddingAvailable = true;
      this.logger.log(
        `🔎 [RAG:search] query embedding OK (${queryEmbedding.length} dims)`,
      );

      relevantChunks = await this.chunkRepo.findSimilar({
        novelId,
        queryEmbedding,
        topK,
        distanceThreshold: this.COSINE_DISTANCE_THRESHOLD,
      });
      this.logger.log(
        `🔎 [RAG:search] retrieved ${relevantChunks.length} chunk(s)`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `🔎 [RAG:search] embedding unavailable, continuing without chunk retrieval: ${message}`,
      );
    }

    const contextParts: string[] = [];
    const sections: string[] = [];

    if (novelContext) {
      const loreSections: [keyof NovelContextFields, string][] = [
        ['characters', 'ตัวละครหลัก'],
        ['worldBuilding', 'ฉากและโลกในเรื่อง'],
        ['plotOutline', 'โครงเรื่องหลัก'],
        ['writingStyle', 'สไตล์การเขียน'],
      ];

      for (const [key, label] of loreSections) {
        let value = novelContext[key];
        if (key === 'characters' && value && cast && cast.length > 0) {
          try {
            const parsed = JSON.parse(value) as unknown;
            if (Array.isArray(parsed)) {
              const castSet = new Set(cast.map((c) => c.toLowerCase()));
              const filtered = (parsed as CastCharacter[]).filter(
                (item) => !!item?.name && castSet.has(item.name.toLowerCase()),
              );
              if (filtered.length > 0) {
                value = filtered
                  .map(
                    (c) =>
                      `- ${c.name}${c.role ? ` (${c.role})` : ''}${c.description ? `: ${c.description}` : ''}`,
                  )
                  .join('\n');
              }
            }
          } catch {
            // Keep original if not JSON array
          }
        }
        if (value) {
          contextParts.push(`## ${label}\n${value}`);
          sections.push(label);
        }
      }
    } else {
      this.logger.warn(
        `🏗️  [RAG:context] NovelContext NOT found for novelId: ${novelId}`,
      );
    }

    if (relevantChunks.length > 0) {
      contextParts.push(
        `## เนื้อเรื่องที่เกี่ยวข้อง\n${relevantChunks
          .map((chunk) => chunk.content)
          .join('\n\n---\n\n')}`,
      );
      sections.push('เนื้อเรื่องที่เกี่ยวข้อง');
    } else {
      this.logger.warn(
        `🏗️  [RAG:context] No relevant RAG chunks found — novel may not have embedded episodes`,
      );
    }

    const contextString = contextParts.join('\n\n');
    this.logger.log(
      `🏗️  [RAG:context] Built — ${contextString.length} chars (${contextParts.length} sections)`,
    );

    return {
      contextString,
      writingStyle: novelContext?.writingStyle ?? null,
      retrieval: {
        chunkCount: relevantChunks.length,
        embeddingAvailable,
        sections,
        contextChars: contextString.length,
        chunks: relevantChunks,
      },
    };
  }
}
