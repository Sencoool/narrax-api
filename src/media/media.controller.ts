import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MediaService } from './media.service.js';

const MAX_IMAGE_BYTES =
  Math.min(Math.max(Number(process.env.MAX_UPLOAD_MB) || 5, 1), 20) *
  1024 *
  1024;

@ApiTags('media')
@Controller('novels')
export class CharacterImageController {
  constructor(private readonly media: MediaService) {}

  @Post(':novelId/characters/:characterId/image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  upload(
    @CurrentUser() user: { id: string },
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @Param('characterId', ParseUUIDPipe) characterId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.media.upload(user.id, novelId, characterId, file);
  }
}

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async read(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const image = await this.media.read(user.id, id);
    response.setHeader('Content-Type', image.mime);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, max-age=60');
    response.end(image.body);
  }
}
