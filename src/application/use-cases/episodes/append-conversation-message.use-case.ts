import { Injectable, Inject } from '@nestjs/common';
import { CONVERSATION_REPOSITORY } from '../../../domain/repositories/conversation.repository.interface.js';
import type { IConversationRepository, ConversationMessageEntity } from '../../../domain/repositories/conversation.repository.interface.js';

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
  ) {}

  async execute(input: AppendConversationMessageInput): Promise<ConversationMessageEntity> {
    return this.conversationRepo.create(input);
  }
}
