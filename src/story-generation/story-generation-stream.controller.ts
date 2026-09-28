import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UserModelsService } from '../user-models/user-models.service';
import { decryptApiKey } from '../common/crypto.util';
import {
  MAX_TARGET_CHARS,
  StreamGenerationDto,
} from './dto/stream-generation.dto';
import { StreamStoryGenerationUseCase } from '../application/use-cases/story-generation/stream-story-generation.use-case';
import { SuggestStorylinesUseCase } from '../application/use-cases/story-generation/suggest-storylines.use-case';
import { SuggestStorylinesDto } from './dto/suggest-storylines.dto';
import { FindGenerationUseCase } from '../application/use-cases/story-generation/find-generation.use-case';
import type {
  StreamEvent,
  StoryPersistence,
} from '../application/use-cases/story-generation/stream-story-generation.use-case';

@ApiTags('story-generations')
@Controller('story-generations')
export class StoryGenerationStreamController {
  private readonly logger = new Logger(StoryGenerationStreamController.name);

  constructor(
    private readonly streamStoryGenerationUseCase: StreamStoryGenerationUseCase,
    private readonly suggestStorylinesUseCase: SuggestStorylinesUseCase,
    private readonly findGenerationUseCase: FindGenerationUseCase,
    private readonly prisma: PrismaService,
    private readonly userModelsService: UserModelsService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List recent generations for an owned episode' })
  listForEpisode(
    @CurrentUser() user: { id: string },
    @Query('episodeId', ParseUUIDPipe) episodeId: string,
  ) {
    return this.findGenerationUseCase.listForEpisode(episodeId, user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Inspect a generation prompt and context' })
  findOne(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.findGenerationUseCase.execute(id, user.id);
  }

  @Post('suggestions')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'เสนอ 3 แนวทางสำหรับเนื้อเรื่องตอนต่อไป' })
  suggestions(
    @CurrentUser() user: { id: string },
    @Body() body: SuggestStorylinesDto,
  ) {
    return this.suggestStorylinesUseCase.execute({ ...body, userId: user.id });
  }

  @Post('stream')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'AI เขียนนิยายแบบ streaming (SSE) — unified',
    description: `สร้างเนื้อเรื่องแบบ real-time ผ่าน Server-Sent Events พร้อม RAG memory

**การควบคุมความยาว (targetChars):**
- ไม่ระบุ / ≤ 2,500 → single-shot (เร็ว, เหมาะกับ co-author/suggestion)
- > 2,500 → segmented อัตโนมัติ (เหมาะกับบทเต็ม 5,000–15,000 ตัวอักษร)
- ระบบจะ clamp ค่าสูงสุดที่ ${MAX_TARGET_CHARS.toLocaleString()} ตัวอักษรเสมอ

**การใช้ episodeId:**
- ระบุ \`episodeId\` → ดึงเนื้อหาตอนนั้นมาเป็น seed หลัก
- \`userMessage\` = คำสั่ง/แนวทาง เช่น "เขียนตอนนี้ให้ละเอียดและสมบูรณ์"

**Event types ที่ client รับ:**
- \`chunk\`: { text } — token จาก AI
- \`segment_start\`: { segment, total } — เริ่ม segment ใหม่ (segmented mode เท่านั้น)
- \`segment_done\`: { segment, chars } — จบ segment (segmented mode เท่านั้น)
- \`done\`: { requestId, totalChars } — จบทั้งหมด
- \`error\`: { message } — เกิดข้อผิดพลาด`,
  })
  async streamGeneration(
    @CurrentUser() user: { id: string },
    @Body() body: StreamGenerationDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // ── SSE write callback ───────────────────────────────────────────────────
    const onEvent = (event: StreamEvent) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    // ── Check active model configuration ─────────────────────────────────────
    let selectedModel;
    try {
      selectedModel = body.modelId
        ? await this.userModelsService.getOwnedConfig(user.id, body.modelId)
        : await this.userModelsService.getDefaultForUser(user.id);
    } catch {
      onEvent({ type: 'error', message: 'Model configuration not found' });
      res.end();
      return;
    }
    if (!selectedModel) {
      onEvent({
        type: 'error',
        message:
          'No AI model configured. Please go to Settings to configure your AI model before generating.',
      });
      res.end();
      return;
    }

    const rawApiKey = selectedModel.apiKey
      ? decryptApiKey(selectedModel.apiKey)
      : undefined;
    const modelConfig = {
      provider: selectedModel.provider,
      modelName: selectedModel.modelName,
      apiKey: rawApiKey,
      baseUrl: selectedModel.baseUrl,
    };

    const abortController = new AbortController();

    // Abort generation the instant the HTTP client disconnects
    res.on('close', () => {
      if (!abortController.signal.aborted) {
        this.logger.log(
          `Client disconnected — aborting ${selectedModel.provider} generation`,
        );
        abortController.abort();
      }
    });

    // ── Persistence callbacks ────────────────────────────────────────────────
    const persistence: StoryPersistence = {
      createRequest: (data) =>
        this.prisma.storyGenerationRequest.create({
          data: {
            novelId: data.novelId,
            sourceEpisodeId: data.sourceEpisodeId,
            prompt: data.prompt,
            systemPrompt: data.systemPrompt,
            contextSnapshot: data.contextSnapshot as never,
            status: 'processing',
            provider: selectedModel.provider,
            model: selectedModel.modelName,
            temperature: data.temperature,
            maxTokens: data.maxTokens,
          },
        }),

      updateRequest: async (id, data) => {
        await this.prisma.storyGenerationRequest.update({
          where: { id },
          data: {
            status: data.status,
            output: data.output,
            error: data.error,
            durationMs: data.durationMs,
          },
        });
      },
    };

    // ── Run the use case ─────────────────────────────────────────────────────
    this.streamStoryGenerationUseCase
      .execute(
        {
          novelId: body.novelId,
          userId: user.id,
          episodeId: body.episodeId,
          userMessage: body.userMessage,
          currentContent: body.currentContent,
          conversationHistory: body.conversationHistory,
          targetChars: body.targetChars,
          temperature: body.temperature,
          maxContextTokens: body.maxContextTokens,
          contextTokens: selectedModel.contextTokens,
          signal: abortController.signal,
          modelConfig,
        },
        onEvent,
        persistence,
      )
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        onEvent({ type: 'error', message });
      })
      .finally(() => {
        if (!res.writableEnded) res.end();
      });
  }
}
