import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { RabbitMqModule } from '../messaging/rabbitmq.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RagModule } from '../rag/rag.module';
import { StoryGenerationStreamController } from './story-generation-stream.controller';
import { StoryGenerationController } from './story-generation.controller';
import { StoryGenerationService } from './story-generation.service';

@Module({
  imports: [PrismaModule, RabbitMqModule, AiModule, RagModule],
  controllers: [StoryGenerationController, StoryGenerationStreamController],
  providers: [StoryGenerationService],
})
export class StoryGenerationModule {}
