import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  GenerationRecord,
  IStoryGenerationRepository,
} from '../../../domain/repositories/story-generation.repository.interface.js';

@Injectable()
export class PrismaStoryGenerationRepository implements IStoryGenerationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<GenerationRecord | null> {
    return this.prisma.storyGenerationRequest.findUnique({ where: { id } });
  }

  findByEpisodeId(episodeId: string): Promise<GenerationRecord[]> {
    return this.prisma.storyGenerationRequest.findMany({
      where: { sourceEpisodeId: episodeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
