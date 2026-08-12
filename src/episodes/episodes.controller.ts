import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
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
import { FileParserService } from './file-parser.service';
import { CreateEpisodeUseCase } from '../application/use-cases/episodes/create-episode.use-case';
import { UploadEpisodeContentUseCase } from '../application/use-cases/episodes/upload-episode-content.use-case';
import { FindEpisodesUseCase } from '../application/use-cases/episodes/find-episodes.use-case';
import { FindOneEpisodeUseCase } from '../application/use-cases/episodes/find-one-episode.use-case';
import { UpdateEpisodeUseCase } from '../application/use-cases/episodes/update-episode.use-case';
import { DeleteEpisodeUseCase } from '../application/use-cases/episodes/delete-episode.use-case';
import { GenerateEpisodeSummaryUseCase } from '../application/use-cases/episodes/generate-episode-summary.use-case';
import { ChunkAndEmbedUseCase } from '../application/use-cases/rag/chunk-and-embed.use-case';
import { Logger } from '@nestjs/common';

@ApiTags('episodes')
@Controller()
export class EpisodesController {
  private readonly logger = new Logger(EpisodesController.name);

  constructor(
    private readonly createEpisodeUseCase: CreateEpisodeUseCase,
    private readonly uploadEpisodeContentUseCase: UploadEpisodeContentUseCase,
    private readonly findEpisodesUseCase: FindEpisodesUseCase,
    private readonly findOneEpisodeUseCase: FindOneEpisodeUseCase,
    private readonly updateEpisodeUseCase: UpdateEpisodeUseCase,
    private readonly deleteEpisodeUseCase: DeleteEpisodeUseCase,
    private readonly generateEpisodeSummaryUseCase: GenerateEpisodeSummaryUseCase,
    private readonly chunkAndEmbedUseCase: ChunkAndEmbedUseCase,
    private readonly fileParserService: FileParserService,
  ) {}

  @Post('novels/:novelId/episodes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'สร้างตอนใหม่',
    description: 'บันทึกตอนและ trigger RAG embedding + AI summary อัตโนมัติ',
  })
  @ApiParam({ name: 'novelId', description: 'Novel UUID' })
  async create(
    @Param('novelId') novelId: string,
    @Body() input: CreateEpisodeDto,
  ) {
    const episode = await this.createEpisodeUseCase.execute(novelId, {
      title: input.title,
      order: input.order,
      isPublished: input.isPublished,
      content: input.content,
    });

    // Fire-and-forget: embed + summary
    this.triggerEmbedding(episode.id, episode.title);
    if (episode.hasContent()) {
      this.triggerSummaryGeneration(episode.id, episode.title);
    }

    return episode;
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
          description: 'ชื่อตอน (ถ้าไม่ระบุระบบจะใช้ "ตอนที่ N")',
        },
        order: {
          type: 'number',
          description: 'ลำดับตอน (ถ้าไม่ระบุจะต่อท้ายตอนสุดท้าย)',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: 'อัปโหลดไฟล์เพื่อเพิ่มเนื้อหานิยาย',
    description: `อัปโหลดไฟล์นิยายรายตอน (.txt) ระบบจะดำเนินการต่อไปนี้แบบ async:
1. บันทึกเนื้อหาเป็น Episode และส่ง HTTP 201 กลับทันที
2. ทำ RAG embedding เข้า Vector Database สำหรับ semantic search
3. ให้ AI สร้าง episodeSummary อัตโนมัติ (สรุปเนื้อหาตอน)

ติดตามผลได้จาก GET /episodes/:id — field \`episodeSummary\` จะมีค่าเมื่อ AI ประมวลผลเสร็จ`,
  })
  @ApiResponse({
    status: 201,
    description: 'Episode ถูกบันทึกแล้ว — AI summary + embedding กำลังทำงานใน background',
  })
  async uploadContent(
    @Param('novelId') novelId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() { title, order }: { title: string; order: number },
  ) {
    if (!file) {
      throw new BadRequestException('กรุณาแนบไฟล์เนื้อหา');
    }

    // File parsing happens in infrastructure (FileParserService)
    const text = this.fileParserService.extractText(file);

    const episode = await this.uploadEpisodeContentUseCase.execute({
      novelId,
      text,
      title: title ?? null,
      order,
    });

    // Fire-and-forget: embed + summary
    this.triggerEmbedding(episode.id, episode.title);
    this.triggerSummaryGeneration(episode.id, episode.title);

    return episode;
  }

  @Get('novels/:novelId/episodes')
  @ApiOperation({ summary: 'รายการตอนของนิยาย' })
  @ApiParam({ name: 'novelId', description: 'Novel UUID' })
  findAll(@Param('novelId') novelId: string) {
    return this.findEpisodesUseCase.execute(novelId);
  }

  @Get('episodes/:id')
  @ApiOperation({ summary: 'ดูรายละเอียดตอน (รวม episodeSummary)' })
  findOne(@Param('id') id: string) {
    return this.findOneEpisodeUseCase.execute(id);
  }

  @Patch('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'แก้ไขตอน',
    description: 'ถ้าแก้ไข content จะ re-embed และ re-generate summary โดยอัตโนมัติ',
  })
  async update(@Param('id') id: string, @Body() input: UpdateEpisodeDto) {
    const episode = await this.updateEpisodeUseCase.execute(id, {
      title: input.title,
      content: input.content,
      order: input.order,
      isPublished: input.isPublished,
    });

    // Re-embed and re-summarise if content changed
    if (input.content) {
      this.triggerEmbedding(episode.id, episode.title);
      this.triggerSummaryGeneration(episode.id, episode.title);
    }

    return episode;
  }

  @Post('episodes/:id/generate-summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'สร้าง / สร้างใหม่ AI summary สำหรับตอน',
    description: `เรียกให้ AI สรุปเนื้อหาตอนและบันทึกลง field \`episodeSummary\`.
⚠️ การเรียก endpoint นี้จะรอจนกว่า AI จะตอบกลับ (synchronous)`,
  })
  @ApiParam({ name: 'id', description: 'Episode UUID' })
  @ApiResponse({
    status: 200,
    description: 'Episode ที่มี episodeSummary ที่ถูก generate ใหม่',
  })
  generateSummary(@Param('id') id: string) {
    return this.generateEpisodeSummaryUseCase.execute(id);
  }

  @Delete('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'ลบตอน (และ vector chunks อัตโนมัติ)' })
  async remove(@Param('id') id: string) {
    await this.deleteEpisodeUseCase.execute(id);
  }

  // ─── Private fire-and-forget helpers ─────────────────────────────────────

  private triggerEmbedding(episodeId: string, episodeTitle: string): void {
    this.chunkAndEmbedUseCase
      .execute(episodeId)
      .then(() => {
        this.logger.log(`✅ Embedded episode: "${episodeTitle}"`);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`❌ Failed to embed episode "${episodeTitle}": ${msg}`);
      });
  }

  private triggerSummaryGeneration(episodeId: string, episodeTitle: string): void {
    this.generateEpisodeSummaryUseCase
      .execute(episodeId)
      .then(() => {
        this.logger.log(`✅ Generated summary for episode: "${episodeTitle}"`);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`❌ Failed to generate summary for episode "${episodeTitle}": ${msg}`);
      });
  }
}
