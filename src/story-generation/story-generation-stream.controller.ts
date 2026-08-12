import {
  Body,
  Controller,
  Logger,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
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
  ) {}

  @Post('stream')
  @UseGuards(JwtAuthGuard)
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
    @Body() body: StreamGenerationDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const abortController = new AbortController();

    // Kill Ollama the instant the HTTP client disconnects
    res.on('close', () => {
      if (!abortController.signal.aborted) {
        this.logger.log('Client disconnected — aborting Ollama generation');
        abortController.abort();
      }
    });

    // ── Persistence callbacks ────────────────────────────────────────────────
    // The use case doesn't know about Prisma — we inject the DB logic via closures.
    const persistence: StoryPersistence = {
      createRequest: (data) =>
        this.prisma.storyGenerationRequest.create({
          data: {
            novelId: data.novelId,
            sourceEpisodeId: data.sourceEpisodeId,
            prompt: data.prompt,
            status: 'processing',
            provider: 'ollama',
            model: 'my-novel-model',
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

    // ── SSE write callback ───────────────────────────────────────────────────
    const onEvent = (event: StreamEvent) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    // ── Run the use case ─────────────────────────────────────────────────────
    this.streamStoryGenerationUseCase
      .execute(
        {
          novelId: body.novelId,
          episodeId: body.episodeId,
          userMessage: body.userMessage,
          currentContent: body.currentContent,
          targetChars: body.targetChars,
          temperature: body.temperature,
          signal: abortController.signal,
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
