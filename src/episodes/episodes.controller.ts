import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { EpisodesService } from './episodes.service';

@ApiTags('episodes')
@Controller()
export class EpisodesController {
  constructor(private readonly episodesService: EpisodesService) { }

  @Post('novels/:novelId/episodes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'สร้างตอนใหม่',
    description: 'บันทึกตอนและ trigger RAG embedding อัตโนมัติ',
  })
  @ApiParam({ name: 'novelId', description: 'Novel UUID' })
  create(@Param('novelId') novelId: string, @Body() input: CreateEpisodeDto) {
    return this.episodesService.create(novelId, input);
  }

  @Post('novels/:novelId/episodes/upload-content')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        title: {
          type: 'string'
        },
        order: {
          type: 'number'
        }
      },
      required: ['file']
    },
  })
  @ApiOperation({
    summary: 'อัปโหลดไฟล์เพื่อเพิ่มเนื้อหานิยาย',
    description: 'อัปโหลดไฟล์นิยายรายตอน แล้วระบบจะทำการตัดเนื้อหาเป็นตอนย่อยและทำการเพิ่มเนื้อหาเข้าสู่ Vector Database โดยอัตโนมัติ'
  })
  async uploadContent(
    @Param('novelId') novelId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() { title, order }: { title: string, order: number }
  ) {
    if (!file) {
      throw new BadRequestException('กรุณาแนบไฟล์เนื้อหา');
    }
    return this.episodesService.uploadContent(novelId, file, title, order);
  }

  @Get('novels/:novelId/episodes')
  @ApiOperation({ summary: 'รายการตอนของนิยาย' })
  @ApiParam({ name: 'novelId', description: 'Novel UUID' })
  findAll(@Param('novelId') novelId: string) {
    return this.episodesService.findAll(novelId);
  }

  @Get('episodes/:id')
  @ApiOperation({ summary: 'ดูรายละเอียดตอน' })
  findOne(@Param('id') id: string) {
    return this.episodesService.findOne(id);
  }

  @Patch('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'แก้ไขตอน',
    description: 'ถ้าแก้ไข content จะ re-embed โดยอัตโนมัติ',
  })
  update(@Param('id') id: string, @Body() input: UpdateEpisodeDto) {
    return this.episodesService.update(id, input);
  }

  @Delete('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ลบตอน (และ vector chunks อัตโนมัติ)' })
  remove(@Param('id') id: string) {
    return this.episodesService.remove(id);
  }
}
