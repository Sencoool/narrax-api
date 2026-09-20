import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module.js';
import { UserModelsController } from './user-models.controller.js';
import { UserModelsService } from './user-models.service.js';

@Module({
  imports: [InfrastructureModule],
  controllers: [UserModelsController],
  providers: [UserModelsService],
  exports: [UserModelsService],
})
export class UserModelsModule {}
