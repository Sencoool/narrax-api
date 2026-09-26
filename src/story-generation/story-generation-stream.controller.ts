import {
  Body,
  Controller,
  Logger,
  Post,
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
    private readonly prisma: PrismaService,
    private readonly userModelsService: UserModelsService,
  ) {}

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
    const defaultModel = await this.userModelsService.getDefaultForUser(user.id);
    if (!defaultModel) {
      onEvent({
        type: 'error',
        message: 'No AI model configured. Please go to Settings to configure your AI model before generating.',
      });
      res.end();
      return;
    }

    const rawApiKey = defaultModel.apiKey ? decryptApiKey(defaultModel.apiKey) : undefined;
    const modelConfig = {
      provider: defaultModel.provider,
      modelName: defaultModel.modelName,
      apiKey: rawApiKey,
      baseUrl: defaultModel.baseUrl,
    };

    const abortController = new AbortController();

    // Abort generation the instant the HTTP client disconnects
    res.on('close', () => {
      if (!abortController.signal.aborted) {
        this.logger.log(`Client disconnected — aborting ${defaultModel.provider} generation`);
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
            status: 'processing',
            provider: defaultModel.provider,
            model: defaultModel.modelName,
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
          },
        });
      },
    };

    // ── Run the use case ─────────────────────────────────────────────────────
    this.streamStoryGenerationUseCase
      .execute(
        {
          novelId: body.novelId,
          episodeId: body.episodeId,
          userMessage: body.userMessage,
          currentContent: body.currentContent,
          conversationHistory: body.conversationHistory,
          targetChars: body.targetChars,
          temperature: body.temperature,
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
