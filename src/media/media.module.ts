import { Module } from '@nestjs/common';
import {
  CharacterImageController,
  MediaController,
} from './media.controller.js';
import { MediaService } from './media.service.js';

@Module({
  controllers: [CharacterImageController, MediaController],
  providers: [MediaService],
})
export class MediaModule {}
