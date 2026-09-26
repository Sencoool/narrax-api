import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  IConversationRepository,
  ConversationMessageEntity,
} from '../../../domain/repositories/conversation.repository.interface.js';

@Injectable()
export class PrismaConversationRepository implements IConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEpisodeId(
    episodeId: string,
    limit = 50,
  ): Promise<ConversationMessageEntity[]> {
    // Fetch the NEWEST `limit` messages and restore chronological order.
    // Ordering ascending with `take` returns the oldest rows instead, which
    // meant a conversation longer than `limit` never surfaced the recent turns
    // the AI needs as multi-turn context.
    const rows = await this.prisma.conversationMessage.findMany({
      where: { episodeId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.reverse().map((r) => ({
      id: r.id,
      episodeId: r.episodeId,
      role: r.role as 'user' | 'assistant',
      content: r.content,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  async create(input: {
    episodeId: string;
    role: 'user' | 'assistant';
    content: string;
    status?: string;
  }): Promise<ConversationMessageEntity> {
    const row = await this.prisma.conversationMessage.create({
      data: {
        episodeId: input.episodeId,
        role: input.role,
        content: input.content,
        status: input.status ?? 'done',
      },
    });
    return {
      id: row.id,
      episodeId: row.episodeId,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      status: row.status,
      createdAt: row.createdAt,
    };
  }

  async deleteByEpisodeId(episodeId: string): Promise<void> {
    await this.prisma.conversationMessage.deleteMany({ where: { episodeId } });
  }
}
