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
  ApiResponse,
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
    description: 'บันทึกตอนและ trigger RAG embedding + AI summary อัตโนมัติ',
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
          description: 'ไฟล์นิยาย (.txt เท่านั้น, สูงสุด 5MB)',
        },
        title: {
          type: 'string',
          description: 'ชื่อตอน (ถ้าไม่ระบุ AI จะแนะนำชื่อให้อัตโนมัติ)',
        },
        order: {
          type: 'number',
          description: 'ลำดับตอน (ถ้าไม่ระบุจะต่อท้ายตอนสุดท้าย)',
        }
      },
      required: ['file']
    },
  })
  @ApiOperation({
    summary: 'อัปโหลดไฟล์เพื่อเพิ่มเนื้อหานิยาย',
    description: `อัปโหลดไฟล์นิยายรายตอน (.txt) ระบบจะดำเนินการต่อไปนี้แบบ async:
1. บันทึกเนื้อหาเป็น Episode และส่ง HTTP 201 กลับทันที
2. ทำ RAG embedding เข้า Vector Database สำหรับ semantic search
3. ให้ AI สร้าง episodeSummary อัตโนมัติ (สรุปเนื้อหาตอน)

ติดตามผลได้จาก GET /episodes/:id — field \`episodeSummary\` จะมีค่าเมื่อ AI ประมวลผลเสร็จ

**หมายเหตุ:** การสร้างเนื้อเรื่องต่อ (AI generation) ต้องกดปุ่มบน frontend แยกต่างหาก
ผ่าน POST /story-generations/stream`,
  })
  @ApiResponse({
    status: 201,
    description: 'Episode ถูกบันทึกแล้ว — AI summary + embedding กำลังทำงานใน background',
    schema: {
      example: {
        id: 'uuid',
        novelId: 'uuid',
        title: 'ตอนที่ 1',
        order: 1,
        isPublished: false,
        episodeSummary: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
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
  @ApiOperation({ summary: 'ดูรายละเอียดตอน (รวม episodeSummary)' })
  findOne(@Param('id') id: string) {
    return this.episodesService.findOne(id);
  }

  @Patch('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'แก้ไขตอน',
    description: 'ถ้าแก้ไข content จะ re-embed และ re-generate summary โดยอัตโนมัติ',
  })
  update(@Param('id') id: string, @Body() input: UpdateEpisodeDto) {
    return this.episodesService.update(id, input);
  }

  @Post('episodes/:id/generate-summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'สร้าง / สร้างใหม่ AI summary สำหรับตอน',
    description: `เรียกให้ AI สรุปเนื้อหาตอนและบันทึกลง field \`episodeSummary\`.
ใช้เมื่อ:
- ยังไม่มี summary (null)
- ต้องการ re-generate summary ใหม่

⚠️ การเรียก endpoint นี้จะรอจนกว่า AI จะตอบกลับ (synchronous) อาจใช้เวลาสักครู่`,
  })
  @ApiParam({ name: 'id', description: 'Episode UUID' })
  @ApiResponse({
    status: 200,
    description: 'Episode ที่มี episodeSummary ที่ถูก generate ใหม่',
  })
  generateSummary(@Param('id') id: string) {
    return this.episodesService.generateSummary(id);
  }

  @Delete('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ลบตอน (และ vector chunks อัตโนมัติ)' })
  remove(@Param('id') id: string) {
    return this.episodesService.remove(id);
  }
}
