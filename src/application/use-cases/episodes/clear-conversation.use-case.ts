import { Injectable, Inject } from '@nestjs/common';
import { CONVERSATION_REPOSITORY } from '../../../domain/repositories/conversation.repository.interface.js';
import type { IConversationRepository } from '../../../domain/repositories/conversation.repository.interface.js';

@Injectable()
export class ClearConversationUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepo: IConversationRepository,
  ) {}

  async execute(episodeId: string): Promise<void> {
    return this.conversationRepo.deleteByEpisodeId(episodeId);
  }
}
