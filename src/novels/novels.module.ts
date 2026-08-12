import { Module } from '@nestjs/common';
import { ApplicationModule } from '../application/application.module';
import { NovelsController } from './novels.controller';

@Module({
  imports: [ApplicationModule],
  controllers: [NovelsController],
})
export class NovelsModule {}
