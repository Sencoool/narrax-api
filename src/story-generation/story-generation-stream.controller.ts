import {
  Body,
  Controller,
  Logger,
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

/** Strip HTML tags to plain text for AI prompt context */
function stripHtml(html: string): string {
  return html
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// ---------------------------------------------------------------------------

@ApiTags('story-generations')
@Controller('story-generations')
export class StoryGenerationStreamController {
  private readonly logger = new Logger(StoryGenerationStreamController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly ragService: RagService,
    private readonly prisma: PrismaService,
  ) { }

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

    // Kill Ollama the instant the HTTP client disconnects (user cancelled)
    res.on('close', () => {
      if (!abortController.signal.aborted) {
        this.logger.log('Client disconnected — aborting Ollama generation');
        abortController.abort();
      }
    });

    const subject = new Subject<MessageEvent>();

    // Manually pipe subject to Express response
    subject.subscribe({
      next: (msg) => res.write(`data: ${msg.data}\n\n`),
      error: () => res.end(),
      complete: () => res.end(),
    });

    // Determine targetChars — use caller's value or fall back to single-shot default.
    // NOTE: inferTargetCharsWithAi was removed because it fired a blocking LLM pre-flight
    // call on every request (UI never sends targetChars), causing 2 simultaneous Ollama
    // requests and severe lag. Default to SINGLE_SHOT_THRESHOLD (2,500) which is fast.
    const targetChars = body.targetChars
      ? Math.min(body.targetChars, MAX_TARGET_CHARS)
      : SINGLE_SHOT_THRESHOLD;

    const mode = targetChars <= SINGLE_SHOT_THRESHOLD ? 'single-shot' : 'segmented';
    this.logger.log(`${'═'.repeat(64)}`);
    this.logger.log(`🎬 [StoryGen] REQUEST — novelId: ${body.novelId}`);
    this.logger.log(`🎬 [StoryGen] episodeId: ${body.episodeId ?? 'none'} | mode: ${mode} | targetChars: ${targetChars}`);
    this.logger.log(`🎬 [StoryGen] userMessage: "${body.userMessage?.slice(0, 120) ?? ''}${(body.userMessage?.length ?? 0) > 120 ? '…' : ''}"`);
    this.logger.log(`🎬 [StoryGen] currentContent from editor: ${body.currentContent ? `${body.currentContent.length} chars` : 'none'}`);

    const pipeline =
      targetChars <= SINGLE_SHOT_THRESHOLD
        ? this.runSingleShotPipeline(body, targetChars, subject, abortController.signal)
        : this.runSegmentedPipeline(body, targetChars, subject, abortController.signal);

    pipeline
      .catch((err: unknown) => {
        // AbortError means the client left — suppress the error event (no one is listening)
        if (err instanceof Error && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        subject.next({ data: JSON.stringify({ type: 'error', message }) });
      })
      .finally(() => {
        subject.complete();
      });
  }

  // ---------------------------------------------------------------------------
  // Private: single-shot pipeline — fast path for short generations
  // ---------------------------------------------------------------------------

  private async runSingleShotPipeline(
    body: StreamGenerationDto,
    targetChars: number,
    subject: Subject<MessageEvent>,
    signal: AbortSignal,
  ): Promise<void> {
    const { novelId, episodeId, userMessage, temperature, currentContent } = body;

    // Fetch novel and source episode first — episode content is needed to build a good RAG query
    const [novel, sourceEpisode] = await Promise.all([
      this.prisma.novel.findUniqueOrThrow({
        where: { id: novelId },
        select: { id: true, title: true, summary: true },
      }),
      episodeId
        ? this.prisma.episode.findUniqueOrThrow({
          where: { id: episodeId },
          select: { id: true, title: true, content: true },
        })
        : Promise.resolve(null),
    ]);

    // Build the story-so-far context first (needed for RAG query):
    // Priority 1: live editor content (currentContent from frontend)
    // Priority 2: saved episode content from DB (sourceEpisode)
    const storySoFar = currentContent
      ? stripHtml(currentContent)
      : sourceEpisode?.content ?? '';

    // Use story content tail as RAG query — semantically much closer to stored episode chunks
    // than a short user instruction like "เขียนตอนที่ 2 ต่อจากตอนที่แล้ว"
    const ragQuery = storySoFar.length > 100 ? storySoFar.slice(-1500) : userMessage;
    const [context, novelContext] = await Promise.all([
      this.ragService.buildContext(novelId, ragQuery),
      this.prisma.novelContext.findUnique({ where: { novelId } }),
    ]);

    this.logger.log(`📚 [StoryGen:single] novel: "${novel.title}" | RAG context: ${context.length} chars`);
    if (!context) this.logger.warn(`📚 [StoryGen:single] ⚠️  RAG context is EMPTY — no episodes embedded or no NovelContext set`);

    const systemPrompt = this.buildSystemPrompt(novel, context, novelContext);
    this.logger.log(`📝 [StoryGen:single] system prompt built — ${systemPrompt.length} chars`);
    this.logger.verbose(`${'─'.repeat(64)}\n[SYSTEM PROMPT — ${systemPrompt.length} chars]\n${'┄'.repeat(64)}\n${systemPrompt}\n${'─'.repeat(64)}`);

    if (storySoFar) {
      this.logger.log(`📝 [StoryGen:single] story-so-far seed: ${storySoFar.length} chars (source: ${currentContent ? 'editor' : 'DB episode'})`);
    } else {
      this.logger.log(`📝 [StoryGen:single] no story-so-far seed — generating from scratch`);
    }

    const aiPrompt = storySoFar
      ? `${userMessage}\n\n---\n## เนื้อเรื่องที่เขียนไปแล้ว (ให้ต่อจากตรงนี้):\n${storySoFar}`
      : userMessage;

    this.logger.log(`📨 [StoryGen:single] final AI prompt: ${aiPrompt.length} chars | maxTokens: ${TOKENS_PER_SEGMENT}`);
    this.logger.verbose(`${'─'.repeat(64)}\n[USER PROMPT — ${aiPrompt.length} chars]\n${'┄'.repeat(64)}\n${aiPrompt}\n${'─'.repeat(64)}`);

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
    this.logger.log(`💾 [StoryGen:single] StoryGenerationRequest created: ${generationRequest.id}`);

    let fullOutput = '';
    try {
      const stream = this.aiService.generateStream(systemPrompt, aiPrompt, {
        temperature,
        maxOutputTokens: TOKENS_PER_SEGMENT,
        signal,
      });

      for await (const chunk of stream) {
        // Stop processing if client already disconnected
        if (signal.aborted) break;
        fullOutput += chunk;
        subject.next({ data: JSON.stringify({ type: 'chunk', text: chunk }) });
      }

      await this.prisma.storyGenerationRequest.update({
        where: { id: generationRequest.id },
        data: { status: 'completed', output: fullOutput },
      });

      this.logger.log(`✅ [StoryGen:single] DONE — ${fullOutput.length} chars generated | requestId: ${generationRequest.id}`);
      this.logger.log(`${'═'.repeat(64)}`);

      subject.next({
        data: JSON.stringify({
          type: 'done',
          requestId: generationRequest.id,
          totalChars: fullOutput.length,
        }),
      });
    } catch (err: unknown) {
      const status = err instanceof Error && err.name === 'AbortError'
        ? 'canceled'
        : 'failed';
      const message = err instanceof Error ? err.message : 'Generation failed';
      await this.prisma.storyGenerationRequest.update({
        where: { id: generationRequest.id },
        data: { status, error: status === 'canceled' ? null : message },
      });
      this.logger.warn(`⚠️  [StoryGen:single] status=${status} | ${message}`);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: segmented pipeline — for full episodes (>2,500 Thai chars)
  // ---------------------------------------------------------------------------

  private async runSegmentedPipeline(
    body: StreamGenerationDto,
    targetChars: number,
    subject: Subject<MessageEvent>,
    signal: AbortSignal,
  ): Promise<void> {
    const { novelId, episodeId, userMessage, temperature, currentContent } = body;

    const totalSegments = Math.ceil(targetChars / SEGMENT_CHARS);

    // Fetch novel and source episode first — episode content is needed to build a good RAG query
    const [novel, sourceEpisode] = await Promise.all([
      this.prisma.novel.findUniqueOrThrow({
        where: { id: novelId },
        select: { id: true, title: true, summary: true },
      }),
      episodeId
        ? this.prisma.episode.findUniqueOrThrow({
          where: { id: episodeId },
          select: { id: true, title: true, content: true },
        })
        : Promise.resolve(null),
    ]);

    // Build the story-so-far context first (needed for RAG query):
    // same priority logic as single-shot
    const storySoFar = currentContent
      ? stripHtml(currentContent)
      : sourceEpisode?.content ?? '';

    // Use story content tail as RAG query — semantically much closer to stored episode chunks
    // than a short user instruction like "เขียนตอนที่ 2 ต่อจากตอนที่แล้ว"
    const ragQuery = storySoFar.length > 100 ? storySoFar.slice(-1500) : userMessage;
    const [context, novelContext] = await Promise.all([
      this.ragService.buildContext(novelId, ragQuery),
      this.prisma.novelContext.findUnique({ where: { novelId } }),
    ]);

    this.logger.log(`📚 [StoryGen:seg] novel: "${novel.title}" | RAG context: ${context.length} chars`);
    this.logger.log(`📚 [StoryGen:seg] totalSegments: ${totalSegments} | SEGMENT_CHARS: ${SEGMENT_CHARS} | targetChars: ${targetChars}`);
    if (!context) this.logger.warn(`📚 [StoryGen:seg] ⚠️  RAG context is EMPTY`);

    const systemPrompt = this.buildSystemPrompt(novel, context, novelContext);
    this.logger.log(`📝 [StoryGen:seg] system prompt built — ${systemPrompt.length} chars`);
    this.logger.verbose(`${'─'.repeat(64)}\n[SYSTEM PROMPT — ${systemPrompt.length} chars]\n${'┄'.repeat(64)}\n${systemPrompt}\n${'─'.repeat(64)}`);

    if (storySoFar) {
      this.logger.log(`📝 [StoryGen:seg] story-so-far seed: ${storySoFar.length} chars (source: ${currentContent ? 'editor' : 'DB episode'})`);
    } else {
      this.logger.log(`📝 [StoryGen:seg] no story-so-far seed — generating from scratch`);
    }

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
    this.logger.log(`💾 [StoryGen:seg] StoryGenerationRequest created: ${generationRequest.id}`);

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
          storySoFar,
          seg,
          totalSegments,
          prevTail,
        );

        this.logger.log(`📄 [StoryGen:seg] segment [${seg}/${totalSegments}] — prompt: ${segmentPrompt.length} chars | prevTail: ${prevTail.length} chars`);
        this.logger.verbose(`${'─'.repeat(64)}\n[SEGMENT ${seg}/${totalSegments} PROMPT — ${segmentPrompt.length} chars]\n${'┄'.repeat(64)}\n${segmentPrompt}\n${'─'.repeat(64)}`);

        let segmentOutput = '';

        const stream = this.aiService.generateStream(
          systemPrompt,
          segmentPrompt,
          { temperature, maxOutputTokens: TOKENS_PER_SEGMENT, signal },
        );

        for await (const chunk of stream) {
          if (signal.aborted) break;
          segmentOutput += chunk;
          fullOutput += chunk;
          subject.next({ data: JSON.stringify({ type: 'chunk', text: chunk }) });
        }

        // If aborted mid-segment, exit the segment loop immediately
        if (signal.aborted) break;

        // Rolling context handoff — carry the tail into the next segment's prompt
        prevTail = segmentOutput.slice(-TAIL_CHARS);

        this.logger.log(`✅ [StoryGen:seg] segment [${seg}/${totalSegments}] DONE — ${segmentOutput.length} chars | running total: ${fullOutput.length} chars`);

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

      this.logger.log(`✅ [StoryGen:seg] ALL DONE — total: ${fullOutput.length} chars across ${totalSegments} segment(s) | requestId: ${generationRequest.id}`);
      this.logger.log(`${'═'.repeat(64)}`);

      subject.next({
        data: JSON.stringify({
          type: 'done',
          requestId: generationRequest.id,
          totalChars: fullOutput.length,
        }),
      });
    } catch (err: unknown) {
      const status = err instanceof Error && err.name === 'AbortError'
        ? 'canceled'
        : 'failed';
      const message = err instanceof Error ? err.message : 'Generation failed';
      await this.prisma.storyGenerationRequest.update({
        where: { id: generationRequest.id },
        data: { status, error: status === 'canceled' ? null : message },
      });
      this.logger.warn(`⚠️  [StoryGen:seg] status=${status} after ${fullOutput.length} chars | ${message}`);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------


  /**
   * Builds the system prompt — context-aware, tone-controlled.
   * writingStyle from NovelContext is elevated to a top-level directive so the model
   * treats it as a binding instruction rather than background context noise.
   */
  private buildSystemPrompt(
    novel: { title: string; summary?: string | null },
    context: string,
    novelContext?: { writingStyle?: string | null; characters?: string | null } | null,
  ): string {
    // --- Tone / writing-style directive (highest priority) ---
    const writingStyleSection = novelContext?.writingStyle?.trim()
      ? `\n\n## ✅ สไตล์และน้ำเสียงที่ต้องใช้ (บังคับเด็ดขาด — ห้ามเบี่ยงเป็นอย่างอื่น)
${novelContext.writingStyle.trim()}`
      : `\n\n## ✅ น้ำเสียงเริ่มต้น (ไม่ได้กำหนดไว้)
- ใช้น้ำเสียงกลาง สุภาพ อ่านง่ายแต่มีความเข้มแข็ง
- อารมณ์ประผมกันอย่างสมดุลย์: สนุก, ลุ้น, ตื่นเต้น, อบอุ่น, ความขัดแย้ง, เศร้าโดยมีเหตุผล`;

    // --- Background knowledge (RAG: episodes + world/characters/plot) ---
    const contextSection = context
      ? `\n\n---\n## ข้อมูลนิยาย\n${context}\n---`
      : '';

    return `คุณเป็นนักเขียนนิยายไทยชั้นเยี่ยม เชี่ยวชาญการแต่งเรื่องแนวต่างๆ

## นิยาย: ${novel.title}
${novel.summary ? `สรุปเรื่อง: ${novel.summary}` : ''}${writingStyleSection}${contextSection}

## คำแนะนำด้านการเขียน
- รักษาความต่อเนื่องของตัวละครและเนื้อเรื่องตาม context ที่ให้ไว้
- ใช้ภาษาไทยที่ถูกต้องและสละสลวยเท่านั้น ห้ามใช้ภาษาอื่นเด็ดขาด
- ห้ามออกนอกเรื่องหรือเพิ่มตัวละครใหม่โดยไม่จำเป็น
- ตอบเป็นเนื้อเรื่องโดยตรง ไม่ต้องอธิบายว่ากำลังทำอะไร

## อารมณ์และน้ำเสียง (ข้อห้ามเด็ดขาด)
- **ห้ามให้ตัวละครร้องไห้ซ้ำ ๆ หรือแสดงความเศร้าสะอึ้งเกินจริงโดยไม่มีเหตุผลที่เพียงพอ** — ถ้าเกิดทุกข์ต้องเกิดจากเหตุการณ์อย่างใดอย่างหนึ่ง ไม่ใช่สภาวะปกติ
- **ใช้อารมณ์ที่หลากหลาย** — ความสนุก, ความลุ้น, ความตึงเครียด, ความอบอุ่น, ความขัดแย้ง, อย่าเน้นแต่ความเศร้าอย่างเดียว
- **ตัวละครมีความเข้มแข็งและเป็นตัวของตัวเอง** — ห้ามพรรณนาตัวละครให้อ่อนแอหรือไร้หนทางสู้
- **เมื่อเขียนอารมณ์เศร้า** ให้เกิดจากเหตุการณ์ที่ชัดเจน และรับมืออย่างสั้น แล้วรับมือด้วยการกระทำหรือความคิด ไม่ใช่แค่อธิบายว่า "เธอเศร้ามาก"

## จังหวะและการบรรยาย (Pacing)
- **ข้ามการกระทำเล็กน้อยที่ไม่มีความหมายต่อเนื้อเรื่อง** เช่น การเดินไปยังสถานที่ การจับลูกบิด การเปิดประตู การก้าวขึ้นบันได ให้ตัดข้ามและไปถึงฉากหรืออารมณ์ที่สำคัญโดยตรง
- **เน้นพลังงานของเรื่อง** — ทุกย่อหน้าต้องผลักดันพล็อต อารมณ์ หรือความขัดแย้งให้เดินหน้า ไม่ใช่แค่บอกว่าตัวละครทำอะไร
- **ใช้ narrative ellipsis** สำหรับการเปลี่ยนฉากและเวลา: "ชั่วโมงต่อมา…" / "เมื่อเธอมาถึง…" แทนการบรรยายทุกขั้นตอน
- **สงวนการบรรยายละเอียด** ไว้เฉพาะจุดที่มีความหมาย: อารมณ์ที่ซับซ้อน, ความขัดแย้ง, การเปิดเผยข้อมูลสำคัญ, ฉากไคลแม็กซ์
- **หลีกเลี่ยง over-telling**: อย่าบอกสิ่งที่ผู้อ่านสามารถอนุมานได้เอง

## รูปแบบการเขียน (Format) — ข้อห้ามเด็ดขาด
- **ห้ามใส่ชื่อตอน ชื่อบท หรือ heading** (เช่น [ตอน: ...], ## ชื่อตอน, ตอนที่ 1) ลงในเนื้อเรื่องที่ตอบกลับ ให้เริ่มต้นเนื้อเรื่องทันทีโดยไม่มีหัวข้อใดๆ
- **ห้ามทวนหรือคัดลอกเนื้อหาที่มีอยู่ใน seed / context** ให้ต่อเรื่องจากจุดที่หยุดไว้เท่านั้น ไม่ใช่เล่าซ้ำ
- **เขียนเป็นร้อยแก้วต่อเนื่อง** (flowing prose) หลายประโยคต่อย่อหน้า ห้ามเขียนประโยคเดียวต่อบรรทัดในรูปแบบรายการ
- **เว้นวรรคย่อหน้าด้วยบรรทัดว่างเพียง 1 บรรทัด** (blank line เดียว) ห้ามเว้น 2 บรรทัดขึ้นไประหว่างประโยคหรือย่อหน้า
- **เขียนในระดับฉาก (scene-level)** — ให้ผู้อ่านเห็น ได้ยิน รู้สึกอยู่ในฉากนั้น ผ่านบทสนทนา การกระทำ และความรู้สึก ไม่ใช่สรุปเนื้อเรื่องในระดับ synopsis`;
  }

  /**
   * Builds the per-segment prompt with rolling context handoff.
   *
   * - Segment 1: introduce the chapter brief and optional seed episode
   * - Segment N>1: continue from the tail of the previous segment
   */
  private buildSegmentPrompt(
    userMessage: string,
    storySoFar: string,
    segment: number,
    totalSegments: number,
    prevTail: string,
  ): string {
    const seedSection = storySoFar
      ? `\n\n## เนื้อเรื่องที่เขียนไปแล้ว (ใช้เป็น seed):\n${storySoFar.slice(-1500)}`
      : '';

    if (segment === 1) {
      return `เขียนเนื้อเรื่องส่วนที่ 1 จากทั้งหมด ${totalSegments} ส่วน ให้มีความยาวประมาณ ${SEGMENT_CHARS} ตัวอักษร

## คำสั่ง / แนวทางบท:
${userMessage}${seedSection}

[เขียนเนื้อเรื่องส่วนแรกเป็นภาษาไทยเท่านั้น จบที่จุดสิ้นสุดประโยคหรือย่อหน้าที่เหมาะสม อย่าเขียนเกิน ${SEGMENT_CHARS + 300} ตัวอักษร]`;
    }

    return `เขียนเนื้อเรื่องส่วนที่ ${segment} จากทั้งหมด ${totalSegments} ส่วน ให้มีความยาวประมาณ ${SEGMENT_CHARS} ตัวอักษร

## เนื้อเรื่องที่เขียนไปแล้ว (ส่วนท้าย):
${prevTail}

[เขียนต่อจากตรงนี้เป็นภาษาไทยเท่านั้น รักษาน้ำเสียง ลีลา และความต่อเนื่องของเรื่อง อย่าทวนเนื้อหาที่ผ่านมา จบที่จุดสิ้นสุดประโยคหรือย่อหน้าที่เหมาะสม]`;
  }
}
