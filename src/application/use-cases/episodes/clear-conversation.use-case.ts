import { Injectable, Inject } from '@nestjs/common';
import { CONVERSATION_REPOSITORY } from '../../../domain/repositories/conversation.repository.interface.js';
import type { IConversationRepository } from '../../../domain/repositories/conversation.repository.interface.js';
import { EnsureEpisodeOwnershipUseCase } from './ensure-episode-ownership.use-case.js';

@Injectable()
export class ClearConversationUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepo: IConversationRepository,
    private readonly ensureEpisodeOwnership: EnsureEpisodeOwnershipUseCase,
  ) {}

  async execute(episodeId: string, userId: string): Promise<void> {
    await this.ensureEpisodeOwnership.execute(episodeId, userId);
    return this.conversationRepo.deleteByEpisodeId(episodeId);
  }
}
