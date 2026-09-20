import { Injectable, Inject } from '@nestjs/common';
import { CONVERSATION_REPOSITORY } from '../../../domain/repositories/conversation.repository.interface.js';
import type { IConversationRepository, ConversationMessageEntity } from '../../../domain/repositories/conversation.repository.interface.js';
import { EnsureEpisodeOwnershipUseCase } from './ensure-episode-ownership.use-case.js';

export interface AppendConversationMessageInput {
  episodeId: string;
  role: 'user' | 'assistant';
  content: string;
  status?: string;
}

@Injectable()
export class AppendConversationMessageUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepo: IConversationRepository,
    private readonly ensureEpisodeOwnership: EnsureEpisodeOwnershipUseCase,
  ) {}

  async execute(
    input: AppendConversationMessageInput,
    userId: string,
  ): Promise<ConversationMessageEntity> {
    // Also guarantees the episode exists, so a bad id fails with 404 instead of
    // a foreign-key violation from the insert.
    await this.ensureEpisodeOwnership.execute(input.episodeId, userId);
    return this.conversationRepo.create(input);
  }
}
