import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ApplicationModule } from '../application/application.module';
import { EpisodesController } from './episodes.controller';
import { FileParserService } from './file-parser.service';

@Module({
  imports: [
    ApplicationModule,
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // Max 5MB
      },
    }),
  ],
  controllers: [EpisodesController],
  providers: [FileParserService],
})
export class EpisodesModule {}
