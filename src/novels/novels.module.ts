import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NovelsController } from './novels.controller';
import { NovelsService } from './novels.service';

@Module({
  imports: [PrismaModule],
  controllers: [NovelsController],
  providers: [NovelsService],
  exports: [NovelsService],
})
export class NovelsModule {}
