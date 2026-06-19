import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EpisodesModule } from './episodes/episodes.module';
import { RabbitMqModule } from './messaging/rabbitmq.module';
import { NovelsModule } from './novels/novels.module';
import { PrismaModule } from './prisma/prisma.module';
import { StoryGenerationModule } from './story-generation/story-generation.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RabbitMqModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    NovelsModule,
    EpisodesModule,
    StoryGenerationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
