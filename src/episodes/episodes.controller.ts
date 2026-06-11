import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { EpisodesService } from './episodes.service';

@ApiTags('episodes')
@Controller()
export class EpisodesController {
  constructor(private readonly episodesService: EpisodesService) {}

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
