export interface ConversationMessageEntity {
  id: string;
  episodeId: string;
  role: 'user' | 'assistant';
  content: string;
  status: string;
  createdAt: Date;
}

export interface IConversationRepository {
  findByEpisodeId(episodeId: string, limit?: number): Promise<ConversationMessageEntity[]>;
  create(input: {
    episodeId: string;
    role: 'user' | 'assistant';
    content: string;
    status?: string;
  }): Promise<ConversationMessageEntity>;
  deleteByEpisodeId(episodeId: string): Promise<void>;
}

export const CONVERSATION_REPOSITORY = Symbol('CONVERSATION_REPOSITORY');
