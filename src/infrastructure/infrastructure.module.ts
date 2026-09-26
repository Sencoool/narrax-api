import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';

// DI tokens
import {
  USER_REPOSITORY,
  NOVEL_REPOSITORY,
  EPISODE_REPOSITORY,
  EPISODE_CHUNK_REPOSITORY,
  CONVERSATION_REPOSITORY,
  USER_MODEL_CONFIG_REPOSITORY,
} from '../domain/repositories/index.js';
import { AI_PROVIDER } from '../application/ports/ai-provider.port.js';
import { PASSWORD_HASHER } from '../application/ports/password-hasher.port.js';

// Implementations
import {
  PrismaUserRepository,
  PrismaNovelRepository,
  PrismaEpisodeRepository,
  PrismaEpisodeChunkRepository,
  PrismaConversationRepository,
  PrismaUserModelConfigRepository,
} from './persistence/repositories/index.js';
import { OllamaAiProvider } from './ai/ollama-ai.provider.js';
import { Argon2PasswordHasher } from './auth/argon2-password-hasher.js';

/**
 * InfrastructureModule
 *
 * Single NestJS module that registers all infrastructure implementations
 * behind their domain interface tokens. Any feature module that imports
 * InfrastructureModule can inject by token (e.g. @Inject(USER_REPOSITORY)).
 *
 * This module is the ONLY place that knows about concrete classes;
 * application-layer use-cases only know about the interface tokens.
 */
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    // -- Persistence -------------------------------------------------------
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: NOVEL_REPOSITORY,
      useClass: PrismaNovelRepository,
    },
    {
      provide: EPISODE_REPOSITORY,
      useClass: PrismaEpisodeRepository,
    },
    {
      provide: EPISODE_CHUNK_REPOSITORY,
      useClass: PrismaEpisodeChunkRepository,
    },
    {
      provide: CONVERSATION_REPOSITORY,
      useClass: PrismaConversationRepository,
    },
    {
      provide: USER_MODEL_CONFIG_REPOSITORY,
      useClass: PrismaUserModelConfigRepository,
    },
    // -- AI ----------------------------------------------------------------
    {
      provide: AI_PROVIDER,
      useClass: OllamaAiProvider,
    },
    // -- Auth --------------------------------------------------------------
    {
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
  ],
  exports: [
    USER_REPOSITORY,
    NOVEL_REPOSITORY,
    EPISODE_REPOSITORY,
    EPISODE_CHUNK_REPOSITORY,
    CONVERSATION_REPOSITORY,
    USER_MODEL_CONFIG_REPOSITORY,
    AI_PROVIDER,
    PASSWORD_HASHER,
  ],
})
export class InfrastructureModule {}
