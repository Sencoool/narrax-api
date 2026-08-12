import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AppController } from './app.controller';
import { ApplicationModule } from './application/application.module';
import { AuthModule } from './auth/auth.module';
import { EpisodesModule } from './episodes/episodes.module';
import { NovelsModule } from './novels/novels.module';
import { PrismaModule } from './prisma/prisma.module';
import { StoryGenerationModule } from './story-generation/story-generation.module';
import { UsersModule } from './users/users.module';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ApplicationModule,
    UsersModule,
    AuthModule,
    NovelsModule,
    EpisodesModule,
    StoryGenerationModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
  ],
})
export class AppModule {}
