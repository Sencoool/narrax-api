import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ApplicationModule } from '../application/application.module';
import { StoryGenerationStreamController } from './story-generation-stream.controller';

@Module({
  imports: [PrismaModule, ApplicationModule],
  controllers: [StoryGenerationStreamController],
})
export class StoryGenerationModule {}
