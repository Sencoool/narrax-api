import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  IEpisodeChunkRepository,
  SimilarChunk,
} from '../../../domain/repositories/episode-chunk.repository.interface.js';
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
    maxEpisodeOrder?: number;
  }): Promise<SimilarChunk[]> {
    const embeddingStr = `[${params.queryEmbedding.join(',')}]`;
    const maxEpisodeOrder = params.maxEpisodeOrder ?? null;

    // CTE: compute distances first, then filter by threshold. The episode title
    // comes along so a trace can say which episode a chunk was pulled from.
    const results = await this.prisma.$queryRaw<
      {
        content: string;
        episodeId: string;
        episodeTitle: string | null;
        dist: number;
      }[]
    >`
      WITH ranked AS (
        SELECT c.content,
               c."episodeId",
               e.title AS "episodeTitle",
               c.embedding <=> ${embeddingStr}::vector(768) AS dist
        FROM "EpisodeChunk" c
        LEFT JOIN "Episode" e ON e.id = c."episodeId"
        WHERE c."novelId" = ${params.novelId}
          AND c.embedding IS NOT NULL
          AND (${maxEpisodeOrder}::integer IS NULL OR e."order" <= ${maxEpisodeOrder})
        ORDER BY dist
        LIMIT ${params.topK}
      )
      SELECT content, "episodeId", "episodeTitle", dist FROM ranked WHERE dist < ${params.distanceThreshold}
    `;

    return results.map((row) => ({
      content: row.content,
      episodeId: row.episodeId,
      episodeTitle: row.episodeTitle,
      distance: Number(row.dist),
    }));
  }
}
