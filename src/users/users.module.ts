import { Module } from '@nestjs/common';
import { ApplicationModule } from '../application/application.module';
import { UsersController } from './users.controller';

@Module({
  imports: [ApplicationModule],
  controllers: [UsersController],
})
export class UsersModule {}
