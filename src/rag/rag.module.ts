import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RagService } from './rag.service';

@Module({
  imports: [PrismaModule, AiModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
