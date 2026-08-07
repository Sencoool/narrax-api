import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IEpisodeRepository,
  EPISODE_REPOSITORY,
} from '../../../domain/repositories/episode.repository.interface.js';
import {
  IEpisodeChunkRepository,
  EPISODE_CHUNK_REPOSITORY,
} from '../../../domain/repositories/episode-chunk.repository.interface.js';
import { IAiProvider, AI_PROVIDER } from '../../ports/ai-provider.port.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

/**
 * Chunks an episode's content and generates embeddings for each chunk.
 * Replaces existing chunks in the DB (delete-then-insert per episode).
 *
 * Chunking strategy (mirrors existing RagService):
 * - CHUNK_SIZE = 800 Thai characters (~400 tokens)
 * - CHUNK_OVERLAP = 100 characters to avoid sentence truncation
 * - Splits preferring newlines > Japanese/Thai period > space
 */
@Injectable()
export class ChunkAndEmbedUseCase {
  private readonly logger = new Logger(ChunkAndEmbedUseCase.name);

  private readonly CHUNK_SIZE = 800;
  private readonly CHUNK_OVERLAP = 100;

  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
    @Inject(EPISODE_CHUNK_REPOSITORY)
    private readonly chunkRepo: IEpisodeChunkRepository,
    @Inject(AI_PROVIDER)
    private readonly ai: IAiProvider,
  ) {}

  async execute(episodeId: string): Promise<void> {
    const episode = await this.episodeRepo.findById(episodeId);
    if (!episode) {
      throw new DomainNotFoundError('ตอน', episodeId);
    }

    this.logger.log(`📥 [RAG:embed] START — episode: "${episode.title}" (${episode.content.length} chars)`);

    // Delete all previous chunks for this episode
    await this.chunkRepo.deleteByEpisodeId(episodeId);
    this.logger.log(`🗑️  [RAG:embed] Previous chunks deleted`);

    const chunks = this.splitIntoChunks(episode.content);
    this.logger.log(`✂️  [RAG:embed] Split into ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      // Prefix chunk with episode title for better semantic context
      const chunkText = `[ตอน: ${episode.title}]\n${chunks[i]}`;

      this.logger.log(`🔢 [RAG:embed] Embedding chunk [${i}/${chunks.length - 1}]...`);
      const embedding = await this.ai.generateEmbedding(chunkText);

      await this.chunkRepo.createWithEmbedding({
        episodeId: episode.id,
        novelId: episode.novelId,
        chunkIndex: i,
        content: chunkText,
        embedding,
      });

      this.logger.log(`💾 [RAG:embed] chunk[${i}] saved (${embedding.length} dims)`);
    }

    this.logger.log(`✅ [RAG:embed] DONE — "${episode.title}" → ${chunks.length} chunks`);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + this.CHUNK_SIZE;

      if (end < text.length) {
        const newlineIdx = text.lastIndexOf('\n', end);
        const periodIdx = text.lastIndexOf('。', end);
        const spaceIdx = text.lastIndexOf(' ', end);

        const cutAt = Math.max(newlineIdx, periodIdx, spaceIdx);
        if (cutAt > start + this.CHUNK_SIZE / 2) {
          end = cutAt + 1;
        }
      }

      chunks.push(text.slice(start, end).trim());
      start = end - this.CHUNK_OVERLAP;
    }

    return chunks.filter((c) => c.length > 0);
  }
}
