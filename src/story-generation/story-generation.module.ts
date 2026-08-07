import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RagModule } from '../rag/rag.module';
import { StoryGenerationStreamController } from './story-generation-stream.controller';

@Module({
  imports: [PrismaModule, AiModule, RagModule],
  controllers: [StoryGenerationStreamController],
})
export class StoryGenerationModule {}
