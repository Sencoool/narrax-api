import {
  Body,
  Controller,
  MessageEvent,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Observable, Subject } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/rag.service';
import {
  MAX_TARGET_CHARS,
  SINGLE_SHOT_THRESHOLD,
  StreamGenerationDto,
} from './dto/stream-generation.dto';

// ---------------------------------------------------------------------------
// Internal constants — never exposed to callers
// ---------------------------------------------------------------------------

/** Thai characters per segment → ~4,000 tokens for qwen2.5 */
const SEGMENT_CHARS = 2_500;

/** Characters carried from the tail of one segment into the next prompt */
const TAIL_CHARS = 500;

/** Token budget per segment call to Ollama */
const TOKENS_PER_SEGMENT = 4_000;

// ---------------------------------------------------------------------------

@ApiTags('story-generations')
@Controller('story-generations')
export class StoryGenerationStreamController {
  constructor(
    private readonly aiService: AiService,
    private readonly ragService: RagService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /story-generations/stream
  // Unified endpoint — auto-selects single-shot or segmented pipeline
  // ---------------------------------------------------------------------------

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
  streamGeneration(
    @Body() body: StreamGenerationDto,
    @Res() res: Response,
  ): Observable<MessageEvent> {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    const subject = new Subject<MessageEvent>();

    // Clamp targetChars to the system ceiling
    const targetChars = Math.min(
      body.targetChars ?? SINGLE_SHOT_THRESHOLD,
      MAX_TARGET_CHARS,
    );

    const pipeline =
      targetChars <= SINGLE_SHOT_THRESHOLD
        ? this.runSingleShotPipeline(body, targetChars, subject)
        : this.runSegmentedPipeline(body, targetChars, subject);

    pipeline.catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      subject.next({ data: JSON.stringify({ type: 'error', message }) });
      subject.complete();
    });

    return subject.asObservable();
  }

  // ---------------------------------------------------------------------------
  // Private: single-shot pipeline — fast path for short generations
  // ---------------------------------------------------------------------------

  private async runSingleShotPipeline(
    body: StreamGenerationDto,
    targetChars: number,
    subject: Subject<MessageEvent>,
  ): Promise<void> {
    const { novelId, episodeId, userMessage, temperature } = body;

    const [novel, context, sourceEpisode] = await Promise.all([
      this.prisma.novel.findUniqueOrThrow({
        where: { id: novelId },
        select: { id: true, title: true, summary: true },
      }),
      this.ragService.buildContext(novelId, userMessage),
      episodeId
        ? this.prisma.episode.findUniqueOrThrow({
            where: { id: episodeId },
            select: { id: true, title: true, content: true },
          })
        : Promise.resolve(null),
    ]);

    const systemPrompt = this.buildSystemPrompt(novel, context);

    const aiPrompt = sourceEpisode
      ? `${userMessage}\n\n---\n## เนื้อหาต้นฉบับตอน "${sourceEpisode.title}" (ใช้เป็น seed หลักในการเขียน):\n${sourceEpisode.content}`
      : userMessage;

    const generationRequest = await this.prisma.storyGenerationRequest.create({
      data: {
        novelId,
        sourceEpisodeId: episodeId ?? null,
        prompt: aiPrompt,
        status: 'processing',
        provider: 'ollama',
        model: 'qwen2.5',
        temperature: temperature ?? null,
        maxTokens: TOKENS_PER_SEGMENT,
      },
    });

    let fullOutput = '';
    try {
      const stream = this.aiService.generateStream(systemPrompt, aiPrompt, {
        temperature,
        maxOutputTokens: TOKENS_PER_SEGMENT,
      });

      for await (const chunk of stream) {
        fullOutput += chunk;
        subject.next({ data: JSON.stringify({ type: 'chunk', text: chunk }) });
      }

      await this.prisma.storyGenerationRequest.update({
        where: { id: generationRequest.id },
        data: { status: 'completed', output: fullOutput },
      });

      subject.next({
        data: JSON.stringify({
          type: 'done',
          requestId: generationRequest.id,
          totalChars: fullOutput.length,
        }),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      await this.prisma.storyGenerationRequest.update({
        where: { id: generationRequest.id },
        data: { status: 'failed', error: message },
      });
      throw err;
    } finally {
      subject.complete();
    }
  }

  // ---------------------------------------------------------------------------
  // Private: segmented pipeline — for full episodes (>2,500 Thai chars)
  // ---------------------------------------------------------------------------

  private async runSegmentedPipeline(
    body: StreamGenerationDto,
    targetChars: number,
    subject: Subject<MessageEvent>,
  ): Promise<void> {
    const { novelId, episodeId, userMessage, temperature } = body;

    const totalSegments = Math.ceil(targetChars / SEGMENT_CHARS);

    const [novel, context, sourceEpisode] = await Promise.all([
      this.prisma.novel.findUniqueOrThrow({
        where: { id: novelId },
        select: { id: true, title: true, summary: true },
      }),
      this.ragService.buildContext(novelId, userMessage),
      episodeId
        ? this.prisma.episode.findUniqueOrThrow({
            where: { id: episodeId },
            select: { id: true, title: true, content: true },
          })
        : Promise.resolve(null),
    ]);

    const systemPrompt = this.buildSystemPrompt(novel, context);

    const generationRequest = await this.prisma.storyGenerationRequest.create({
      data: {
        novelId,
        sourceEpisodeId: episodeId ?? null,
        prompt: userMessage,
        status: 'processing',
        provider: 'ollama',
        model: 'qwen2.5',
        temperature: temperature ?? null,
        maxTokens: TOKENS_PER_SEGMENT * totalSegments,
      },
    });

    let fullOutput = '';
    let prevTail = '';

    try {
      for (let seg = 1; seg <= totalSegments; seg++) {
        subject.next({
          data: JSON.stringify({
            type: 'segment_start',
            segment: seg,
            total: totalSegments,
          }),
        });

        const segmentPrompt = this.buildSegmentPrompt(
          userMessage,
          sourceEpisode,
          seg,
          totalSegments,
          prevTail,
        );

        let segmentOutput = '';

        const stream = this.aiService.generateStream(
          systemPrompt,
          segmentPrompt,
          { temperature, maxOutputTokens: TOKENS_PER_SEGMENT },
        );

        for await (const chunk of stream) {
          segmentOutput += chunk;
          fullOutput += chunk;
          subject.next({ data: JSON.stringify({ type: 'chunk', text: chunk }) });
        }

        // Rolling context handoff — carry the tail into the next segment's prompt
        prevTail = segmentOutput.slice(-TAIL_CHARS);

        subject.next({
          data: JSON.stringify({
            type: 'segment_done',
            segment: seg,
            chars: segmentOutput.length,
          }),
        });
      }

      await this.prisma.storyGenerationRequest.update({
        where: { id: generationRequest.id },
        data: { status: 'completed', output: fullOutput },
      });

      subject.next({
        data: JSON.stringify({
          type: 'done',
          requestId: generationRequest.id,
          totalChars: fullOutput.length,
        }),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      await this.prisma.storyGenerationRequest.update({
        where: { id: generationRequest.id },
        data: { status: 'failed', error: message },
      });
      throw err;
    } finally {
      subject.complete();
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Builds the system prompt — context-aware, no hardcoded length instructions.
   * The user's userMessage and targetChars drive the AI's direction entirely.
   */
  private buildSystemPrompt(
    novel: { title: string; summary?: string | null },
    context: string,
  ): string {
    const contextSection = context
      ? `\n\n---\n## ข้อมูลนิยาย\n${context}\n---`
      : '';

    return `คุณเป็นนักเขียนนิยายไทยชั้นเยี่ยม เชี่ยวชาญการแต่งเรื่องแนวต่างๆ

## นิยาย: ${novel.title}
${novel.summary ? `สรุปเรื่อง: ${novel.summary}` : ''}${contextSection}

## คำแนะนำ
- รักษาความต่อเนื่องของตัวละครและเนื้อเรื่องตาม context ที่ให้ไว้
- ใช้ภาษาไทยที่ถูกต้องและสละสลวย
- บรรยายฉากและอารมณ์ให้ชัดเจน ละเอียด
- ห้ามออกนอกเรื่องหรือเพิ่มตัวละครใหม่โดยไม่จำเป็น
- ตอบเป็นเนื้อเรื่องโดยตรง ไม่ต้องอธิบายว่ากำลังทำอะไร`;
  }

  /**
   * Builds the per-segment prompt with rolling context handoff.
   *
   * - Segment 1: introduce the chapter brief and optional seed episode
   * - Segment N>1: continue from the tail of the previous segment
   */
  private buildSegmentPrompt(
    userMessage: string,
    sourceEpisode: { title: string; content: string } | null,
    segment: number,
    totalSegments: number,
    prevTail: string,
  ): string {
    const seedSection = sourceEpisode
      ? `\n\n## เนื้อหาต้นฉบับ (ใช้เป็น seed):\n${sourceEpisode.content.slice(0, 1500)}`
      : '';

    if (segment === 1) {
      return `เขียนเนื้อเรื่องส่วนที่ 1 จากทั้งหมด ${totalSegments} ส่วน ให้มีความยาวประมาณ ${SEGMENT_CHARS} ตัวอักษร

## คำสั่ง / แนวทางบท:
${userMessage}${seedSection}

[เขียนเนื้อเรื่องส่วนแรก จบที่จุดสิ้นสุดประโยคหรือย่อหน้าที่เหมาะสม อย่าเขียนเกิน ${SEGMENT_CHARS + 300} ตัวอักษร]`;
    }

    return `เขียนเนื้อเรื่องส่วนที่ ${segment} จากทั้งหมด ${totalSegments} ส่วน ให้มีความยาวประมาณ ${SEGMENT_CHARS} ตัวอักษร

## เนื้อเรื่องที่เขียนไปแล้ว (ส่วนท้าย):
${prevTail}

[เขียนต่อจากตรงนี้ รักษาน้ำเสียง ลีลา และความต่อเนื่องของเรื่อง อย่าทวนเนื้อหาที่ผ่านมา จบที่จุดสิ้นสุดประโยคหรือย่อหน้าที่เหมาะสม]`;
  }
}
