import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RagModule } from '../rag/rag.module';
import { EpisodesController } from './episodes.controller';
import { EpisodesService } from './episodes.service';
import { FileParserService } from './file-parser.service';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    PrismaModule,
    RagModule,
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // Max 5MB
      },
    }),
  ],
  controllers: [EpisodesController],
  providers: [EpisodesService, FileParserService],
  exports: [EpisodesService],
})
export class EpisodesModule {}


