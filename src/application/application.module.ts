import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module.js';

// ── Auth ────────────────────────────────────────────────────────────────────
import { RegisterUseCase } from './use-cases/auth/register.use-case.js';
import { LoginUseCase } from './use-cases/auth/login.use-case.js';
import { ValidateGoogleUserUseCase } from './use-cases/auth/validate-google-user.use-case.js';
import { RevokeAllTokensUseCase } from './use-cases/auth/revoke-all-tokens.use-case.js';
import { FindEpisodeRevisionsUseCase } from './use-cases/episodes/find-episode-revisions.use-case.js';
import { RestoreEpisodeRevisionUseCase } from './use-cases/episodes/restore-episode-revision.use-case.js';

// ── Users ────────────────────────────────────────────────────────────────────
import { FindAllUsersUseCase } from './use-cases/users/find-all-users.use-case.js';
import { FindOneUserUseCase } from './use-cases/users/find-one-user.use-case.js';
import { UpdateUserUseCase } from './use-cases/users/update-user.use-case.js';
import { DeleteUserUseCase } from './use-cases/users/delete-user.use-case.js';

// ── Novels ───────────────────────────────────────────────────────────────────
import { CreateNovelUseCase } from './use-cases/novels/create-novel.use-case.js';
import { FindNovelsUseCase } from './use-cases/novels/find-novels.use-case.js';
import { FindOneNovelUseCase } from './use-cases/novels/find-one-novel.use-case.js';
import { UpdateNovelUseCase } from './use-cases/novels/update-novel.use-case.js';
import { DeleteNovelUseCase } from './use-cases/novels/delete-novel.use-case.js';
import { FindNovelContextUseCase } from './use-cases/novels/find-novel-context.use-case.js';
import { UpsertNovelContextUseCase } from './use-cases/novels/upsert-novel-context.use-case.js';

// ── Episodes ─────────────────────────────────────────────────────────────────
import { CreateEpisodeUseCase } from './use-cases/episodes/create-episode.use-case.js';
import { UploadEpisodeContentUseCase } from './use-cases/episodes/upload-episode-content.use-case.js';
import { FindEpisodesUseCase } from './use-cases/episodes/find-episodes.use-case.js';
import { FindOneEpisodeUseCase } from './use-cases/episodes/find-one-episode.use-case.js';
import { UpdateEpisodeUseCase } from './use-cases/episodes/update-episode.use-case.js';
import { DeleteEpisodeUseCase } from './use-cases/episodes/delete-episode.use-case.js';
import { GenerateEpisodeSummaryUseCase } from './use-cases/episodes/generate-episode-summary.use-case.js';

// ── RAG ───────────────────────────────────────────────────────────────────────
import { ChunkAndEmbedUseCase } from './use-cases/rag/chunk-and-embed.use-case.js';
import { BuildRagContextUseCase } from './use-cases/rag/build-rag-context.use-case.js';

// -- Conversation History ---------------------------------------------------
import { EnsureEpisodeOwnershipUseCase } from './use-cases/episodes/ensure-episode-ownership.use-case.js';
import { GetConversationUseCase } from './use-cases/episodes/get-conversation.use-case.js';
import { AppendConversationMessageUseCase } from './use-cases/episodes/append-conversation-message.use-case.js';
import { ClearConversationUseCase } from './use-cases/episodes/clear-conversation.use-case.js';

// -- Story Generation -------------------------------------------------------
import { StreamStoryGenerationUseCase } from './use-cases/story-generation/stream-story-generation.use-case.js';
import { MultiProviderStreamService } from '../story-generation/multi-provider-stream.service.js';

import { ListCharacterBoardUseCase } from './use-cases/characters/list-character-board.use-case.js';
import { SaveCharacterUseCase } from './use-cases/characters/save-character.use-case.js';
import { DeleteCharacterUseCase } from './use-cases/characters/delete-character.use-case.js';
import { SaveFactionUseCase } from './use-cases/characters/save-faction.use-case.js';
import { DeleteFactionUseCase } from './use-cases/characters/delete-faction.use-case.js';

const USE_CASES = [
  MultiProviderStreamService,
  // Auth
  RegisterUseCase,
  LoginUseCase,
  ValidateGoogleUserUseCase,
  RevokeAllTokensUseCase,
  // Episode revisions
  FindEpisodeRevisionsUseCase,
  RestoreEpisodeRevisionUseCase,
  // Users
  FindAllUsersUseCase,
  FindOneUserUseCase,
  UpdateUserUseCase,
  DeleteUserUseCase,
  // Novels
  CreateNovelUseCase,
  FindNovelsUseCase,
  FindOneNovelUseCase,
  UpdateNovelUseCase,
  DeleteNovelUseCase,
  FindNovelContextUseCase,
  UpsertNovelContextUseCase,
  // Episodes
  CreateEpisodeUseCase,
  UploadEpisodeContentUseCase,
  FindEpisodesUseCase,
  FindOneEpisodeUseCase,
  UpdateEpisodeUseCase,
  DeleteEpisodeUseCase,
  GenerateEpisodeSummaryUseCase,
  // RAG
  ChunkAndEmbedUseCase,
  BuildRagContextUseCase,
  // Story Generation
  StreamStoryGenerationUseCase,
  // Conversation
  EnsureEpisodeOwnershipUseCase,
  GetConversationUseCase,
  AppendConversationMessageUseCase,
  ClearConversationUseCase,
  ListCharacterBoardUseCase,
  SaveCharacterUseCase,
  DeleteCharacterUseCase,
  SaveFactionUseCase,
  DeleteFactionUseCase,
];

/**
 * ApplicationModule
 *
 * Registers all use cases as NestJS providers.
 * Imports InfrastructureModule so that DI tokens (USER_REPOSITORY, AI_PROVIDER, etc.)
 * are available for injection into use case constructors.
 *
 * Feature modules import ApplicationModule to get access to all use cases.
 */
@Module({
  imports: [InfrastructureModule],
  providers: USE_CASES,
  exports: USE_CASES,
})
export class ApplicationModule {}
