import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IEpisodeChunkRepository,
  EPISODE_CHUNK_REPOSITORY,
} from '../../../domain/repositories/episode-chunk.repository.interface.js';
import { INovelRepository, NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import { IAiProvider, AI_PROVIDER } from '../../ports/ai-provider.port.js';

/** The fields from NovelContext that are used to build the AI context string. */
interface NovelContextFields {
  characters: string | null;
  worldBuilding: string | null;
  plotOutline: string | null;
  writingStyle: string | null;
}

export interface BuildRagContextResult {
  /** The full context string to inject into the system prompt. */
  contextString: string;
  /** The writingStyle value (lifted out separately so the controller can use it directly). */
  writingStyle: string | null;
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
  ): Promise<BuildRagContextResult> {
    this.logger.log(`🏗️  [RAG:context] Building context for novelId: ${novelId}`);

    // Run embedding + context fetch concurrently
    const [queryEmbedding, novelContext] = await Promise.all([
      this.ai.generateEmbedding(ragQuery),
      this.novelRepo.findContext(novelId),
    ]);

    this.logger.log(`🔎 [RAG:search] query embedding OK (${queryEmbedding.length} dims)`);

    const relevantChunks = await this.chunkRepo.findSimilar({
      novelId,
      queryEmbedding,
      topK,
      distanceThreshold: this.COSINE_DISTANCE_THRESHOLD,
    });

    this.logger.log(`🔎 [RAG:search] retrieved ${relevantChunks.length} chunk(s)`);

    const contextParts: string[] = [];

    if (novelContext) {
      const sections: [keyof NovelContextFields, string][] = [
        ['characters', 'ตัวละครหลัก'],
        ['worldBuilding', 'ฉากและโลกในเรื่อง'],
        ['plotOutline', 'โครงเรื่องหลัก'],
        ['writingStyle', 'สไตล์การเขียน'],
      ];

      for (const [key, label] of sections) {
        const value = novelContext[key];
        if (value) {
          contextParts.push(`## ${label}\n${value}`);
        }
      }
    } else {
      this.logger.warn(`🏗️  [RAG:context] NovelContext NOT found for novelId: ${novelId}`);
    }

    if (relevantChunks.length > 0) {
      contextParts.push(
        `## เนื้อเรื่องที่เกี่ยวข้อง\n${relevantChunks.join('\n\n---\n\n')}`,
      );
    } else {
      this.logger.warn(`🏗️  [RAG:context] No relevant RAG chunks found — novel may not have embedded episodes`);
    }

    const contextString = contextParts.join('\n\n');
    this.logger.log(`🏗️  [RAG:context] Built — ${contextString.length} chars (${contextParts.length} sections)`);

    return {
      contextString,
      writingStyle: novelContext?.writingStyle ?? null,
    };
  }
}
