import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ApplicationModule } from '../application/application.module';
import { UserModelsModule } from '../user-models/user-models.module';
import { StoryGenerationStreamController } from './story-generation-stream.controller';

@Module({
  imports: [PrismaModule, ApplicationModule, UserModelsModule],
  controllers: [StoryGenerationStreamController],
})
export class StoryGenerationModule {}
