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
import {
  CHARACTER_REPOSITORY,
  type ICharacterRepository,
} from '../../../domain/repositories/character.repository.interface.js';

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
    @Inject(CHARACTER_REPOSITORY)
    private readonly characters: ICharacterRepository,
  ) {}

  async execute(
    novelId: string,
    ragQuery: string,
    topK = this.DEFAULT_TOP_K,
    cast?: string[],
    episodeOrderBeingWritten = 0,
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
        maxEpisodeOrder: episodeOrderBeingWritten,
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

    const characterBoard = await this.characters.listBoard(novelId);
    const castSet = cast?.length
      ? new Set(cast.map((name) => name.toLowerCase()))
      : null;
    const visibleCharacters = characterBoard.characters.filter(
      (character) =>
        (character.introducedAtOrder === null ||
          character.introducedAtOrder <= episodeOrderBeingWritten) &&
        (!castSet || castSet.has(character.name.toLowerCase())),
    );

    let characterText = visibleCharacters
      .map(
        (character) =>
          `- ${character.name}${character.role ? ` (${character.role})` : ''}${character.description ? `: ${character.description}` : ''}`,
      )
      .join('\n');

    // Old novels can still have only the JSON blob; preserve that path until
    // every installation has applied the backfill migration.
    if (characterBoard.characters.length === 0 && novelContext?.characters) {
      try {
        const parsed = JSON.parse(novelContext.characters) as unknown;
        if (Array.isArray(parsed)) {
          characterText = (parsed as CastCharacter[])
            .filter((character) =>
              character?.name && castSet
                ? castSet.has(character.name.toLowerCase())
                : !!character?.name,
            )
            .map(
              (character) =>
                `- ${character.name}${character.role ? ` (${character.role})` : ''}${character.description ? `: ${character.description}` : ''}`,
            )
            .join('\n');
        } else if (!castSet) {
          characterText = novelContext.characters;
        }
      } catch {
        if (!castSet) characterText = novelContext.characters;
      }
    }

    if (characterText) {
      contextParts.push(`## ตัวละครหลัก\n${characterText}`);
      sections.push('ตัวละครหลัก');
    }

    if (visibleCharacters.length > 0) {
      const factionText = characterBoard.factions
        .map((faction) => {
          const members = visibleCharacters
            .filter((character) => character.factionIds.includes(faction.id))
            .map((character) => {
              const rank = character.factionMemberships.find(
                (membership) => membership.factionId === faction.id,
              )?.rank;
              return `${character.name}${rank ? ` (${rank})` : ''}`;
            });
          return members.length
            ? `- ${faction.name}: ${members.join(', ')}`
            : null;
        })
        .filter((line): line is string => line !== null)
        .join('\n');
      if (factionText) {
        contextParts.push(`## ฝ่าย\n${factionText}`);
        sections.push('ฝ่าย');
      }
    }

    if (novelContext) {
      const loreSections: [keyof NovelContextFields, string][] = [
        ['worldBuilding', 'ฉากและโลกในเรื่อง'],
        ['plotOutline', 'โครงเรื่องหลัก'],
        ['writingStyle', 'สไตล์การเขียน'],
      ];

      for (const [key, label] of loreSections) {
        const value = novelContext[key];
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
