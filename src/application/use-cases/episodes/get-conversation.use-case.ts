import { Injectable, Inject } from '@nestjs/common';
import { CONVERSATION_REPOSITORY } from '../../../domain/repositories/conversation.repository.interface.js';
import type { IConversationRepository, ConversationMessageEntity } from '../../../domain/repositories/conversation.repository.interface.js';

@Injectable()
export class GetConversationUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepo: IConversationRepository,
  ) {}

  async execute(episodeId: string, limit = 50): Promise<ConversationMessageEntity[]> {
    return this.conversationRepo.findByEpisodeId(episodeId, limit);
  }
}
