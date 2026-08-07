import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { IEpisodeChunkRepository } from '../../../domain/repositories/episode-chunk.repository.interface.js';
import { EpisodeChunkEntity } from '../../../domain/entities/episode-chunk.entity.js';

/**
 * Prisma implementation of IEpisodeChunkRepository.
 *
 * Vector operations (embedding insert + cosine search) use raw SQL
 * because Prisma does not natively support the pgvector `vector` type.
 * This raw SQL is intentionally isolated here — no other layer touches it.
 */
@Injectable()
export class PrismaEpisodeChunkRepository implements IEpisodeChunkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async deleteByEpisodeId(episodeId: string): Promise<void> {
    await this.prisma.episodeChunk.deleteMany({ where: { episodeId } });
  }

  async createWithEmbedding(data: {
    episodeId: string;
    novelId: string;
    chunkIndex: number;
    content: string;
    embedding: number[];
  }): Promise<EpisodeChunkEntity> {
    const embeddingStr = `[${data.embedding.join(',')}]`;

    // Raw INSERT because Prisma cannot write to a vector(768) column directly.
    await this.prisma.$executeRaw`
      INSERT INTO "EpisodeChunk" (id, "episodeId", "novelId", "chunkIndex", content, embedding, "createdAt")
      VALUES (
        gen_random_uuid()::text,
        ${data.episodeId},
        ${data.novelId},
        ${data.chunkIndex},
        ${data.content},
        ${embeddingStr}::vector(768),
        NOW()
      )
      ON CONFLICT DO NOTHING
    `;

    // Re-fetch the saved row so we can return a proper entity.
    const saved = await this.prisma.episodeChunk.findFirst({
      where: {
        episodeId: data.episodeId,
        chunkIndex: data.chunkIndex,
      },
      orderBy: { createdAt: 'desc' },
    });

    // This should never be null right after INSERT — throw if it is.
    if (!saved) {
      throw new Error(
        `Failed to retrieve saved EpisodeChunk after INSERT (episodeId=${data.episodeId}, chunkIndex=${data.chunkIndex})`,
      );
    }

    return new EpisodeChunkEntity({
      id: saved.id,
      episodeId: saved.episodeId,
      novelId: saved.novelId,
      chunkIndex: saved.chunkIndex,
      content: saved.content,
      createdAt: saved.createdAt,
    });
  }

  async findSimilar(params: {
    novelId: string;
    queryEmbedding: number[];
    topK: number;
    distanceThreshold: number;
  }): Promise<string[]> {
    const embeddingStr = `[${params.queryEmbedding.join(',')}]`;

    // CTE: compute distances first, then filter by threshold.
    const results = await this.prisma.$queryRaw<{ content: string }[]>`
      WITH ranked AS (
        SELECT content, embedding <=> ${embeddingStr}::vector(768) AS dist
        FROM "EpisodeChunk"
        WHERE "novelId" = ${params.novelId}
          AND embedding IS NOT NULL
        ORDER BY dist
        LIMIT ${params.topK}
      )
      SELECT content FROM ranked WHERE dist < ${params.distanceThreshold}
    `;

    return results.map((r: { content: string }) => r.content);
  }
}
