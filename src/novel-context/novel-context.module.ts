import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NovelContextController } from './novel-context.controller';
import { NovelContextService } from './novel-context.service';

@Module({
  imports: [PrismaModule],
  controllers: [NovelContextController],
  providers: [NovelContextService],
  exports: [NovelContextService],
})
export class NovelContextModule {}
