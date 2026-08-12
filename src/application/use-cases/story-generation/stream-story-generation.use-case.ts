import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IAiProvider } from '../../ports/ai-provider.port.js';
import { AI_PROVIDER } from '../../ports/ai-provider.port.js';
import { BuildRagContextUseCase } from '../rag/build-rag-context.use-case.js';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

// ─── Internal constants ──────────────────────────────────────────────────────

/** Thai characters per segment → ~4,000 tokens for qwen-class models */
const SEGMENT_CHARS = 2_500;

/** Characters carried from the tail of one segment into the next prompt */
const TAIL_CHARS = 500;

/** Token budget per segment call to Ollama */
const TOKENS_PER_SEGMENT = 4_000;

/** Below this threshold → single-shot; at or above → segmented */
const SINGLE_SHOT_THRESHOLD = 2_500;

// ─────────────────────────────────────────────────────────────────────────────

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

// ─── SSE event types emitted by the use case ────────────────────────────────

export interface ChunkEvent {
  type: 'chunk';
  text: string;
}

export interface SegmentStartEvent {
  type: 'segment_start';
  segment: number;
  total: number;
}

export interface SegmentDoneEvent {
  type: 'segment_done';
  segment: number;
  chars: number;
}

export interface DoneEvent {
  type: 'done';
  requestId: string;
  totalChars: number;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type StreamEvent =
  | ChunkEvent
  | SegmentStartEvent
  | SegmentDoneEvent
  | DoneEvent
  | ErrorEvent;

// ─── Input / Output ──────────────────────────────────────────────────────────

export interface StreamStoryGenerationInput {
  novelId: string;
  episodeId?: string;
  userMessage: string;
  /** HTML content from the frontend editor (current unsaved state) */
  currentContent?: string;
  targetChars?: number;
  temperature?: number;
  /** AbortSignal to cancel when the client disconnects */
  signal?: AbortSignal;
}

/** Callback invoked for each SSE event — the controller writes it to the response. */
export type StreamEventCallback = (event: StreamEvent) => void;

/**
 * Persistence callbacks injected by the controller as a closure.
 * This keeps the use case free from direct Prisma/infrastructure imports.
 */
export interface StoryPersistence {
  createRequest(data: {
    novelId: string;
    sourceEpisodeId: string | null;
    prompt: string;
    maxTokens: number;
    temperature: number | null;
  }): Promise<{ id: string }>;

  updateRequest(
    id: string,
    data: {
      status: 'completed' | 'failed' | 'canceled';
      output?: string;
      error?: string | null;
    },
  ): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * StreamStoryGenerationUseCase
 *
 * Orchestrates the full story-generation pipeline:
 * 1. Load novel + source episode from repository
 * 2. Build RAG context (cosine search + NovelContext)
 * 3. Build system prompt with tone constraints
 * 4. Stream tokens from the AI provider
 * 5. Persist a StoryGenerationRequest record via StoryPersistence callbacks
 *
 * Supports two modes auto-selected by targetChars:
 * - Single-shot: one call, fast, ≤ SINGLE_SHOT_THRESHOLD chars
 * - Segmented: multiple calls stitched together, for longer episodes
 */
@Injectable()
export class StreamStoryGenerationUseCase {
  private readonly logger = new Logger(StreamStoryGenerationUseCase.name);

  constructor(
    @Inject(AI_PROVIDER)
    private readonly ai: IAiProvider,
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
    private readonly buildRagContext: BuildRagContextUseCase,
  ) {}

  async execute(
    input: StreamStoryGenerationInput,
    onEvent: StreamEventCallback,
    persistence: StoryPersistence,
  ): Promise<void> {
    const targetChars = input.targetChars
      ? Math.min(input.targetChars, 15_000)
      : SINGLE_SHOT_THRESHOLD;

    const mode = targetChars <= SINGLE_SHOT_THRESHOLD ? 'single-shot' : 'segmented';

    this.logger.log(`${'═'.repeat(64)}`);
    this.logger.log(`🎬 [StoryGen] REQUEST — novelId: ${input.novelId} | mode: ${mode} | targetChars: ${targetChars}`);

    // ── 1. Load novel ──────────────────────────────────────────────────────
    const novel = await this.novelRepo.findById(input.novelId);
    if (!novel) {
      throw new DomainNotFoundError('นิยาย', input.novelId);
    }

    // ── 2. Load source episode (optional) ─────────────────────────────────
    const sourceEpisode = input.episodeId
      ? await this.episodeRepo.findById(input.episodeId)
      : null;

    if (input.episodeId && !sourceEpisode) {
      throw new DomainNotFoundError('ตอน', input.episodeId);
    }

    // ── 3. Build story-so-far seed ─────────────────────────────────────────
    // Priority: live editor content > saved episode content > empty
    const storySoFar = input.currentContent
      ? stripHtml(input.currentContent)
      : sourceEpisode?.content ?? '';

    // Use the tail of existing content as RAG query — closer to stored chunks
    // than a short user instruction
    const ragQuery =
      storySoFar.length > 100 ? storySoFar.slice(-1500) : input.userMessage;

    // ── 4. Build RAG context ───────────────────────────────────────────────
    const { contextString, writingStyle } = await this.buildRagContext.execute(
      input.novelId,
      ragQuery,
    );

    this.logger.log(
      `📚 [StoryGen] novel: "${novel.title}" | RAG context: ${contextString.length} chars`,
    );

    // ── 5. Build system prompt ─────────────────────────────────────────────
    const systemPrompt = this.buildSystemPrompt(
      { title: novel.title, summary: novel.summary },
      contextString,
      { writingStyle },
    );

    // ── 6. Dispatch to correct pipeline ───────────────────────────────────
    if (mode === 'single-shot') {
      await this.runSingleShot(
        input,
        storySoFar,
        systemPrompt,
        onEvent,
        persistence,
      );
    } else {
      await this.runSegmented(
        input,
        storySoFar,
        systemPrompt,
        targetChars,
        onEvent,
        persistence,
      );
    }
  }

  // ─── Single-shot pipeline ──────────────────────────────────────────────────

  private async runSingleShot(
    input: StreamStoryGenerationInput,
    storySoFar: string,
    systemPrompt: string,
    onEvent: StreamEventCallback,
    persistence: StoryPersistence,
  ): Promise<void> {
    const aiPrompt = storySoFar
      ? `${input.userMessage}\n\n---\n## เนื้อเรื่องที่เขียนไปแล้ว (ให้ต่อจากตรงนี้):\n${storySoFar}`
      : input.userMessage;

    this.logger.log(`📨 [StoryGen:single] prompt: ${aiPrompt.length} chars | maxTokens: ${TOKENS_PER_SEGMENT}`);

    const request = await persistence.createRequest({
      novelId: input.novelId,
      sourceEpisodeId: input.episodeId ?? null,
      prompt: aiPrompt,
      maxTokens: TOKENS_PER_SEGMENT,
      temperature: input.temperature ?? null,
    });

    let fullOutput = '';
    try {
      const stream = this.ai.stream(systemPrompt, aiPrompt, {
        temperature: input.temperature,
        maxOutputTokens: TOKENS_PER_SEGMENT,
        ...(input.signal ? { signal: input.signal } : {}),
      });

      for await (const chunk of stream) {
        if (input.signal?.aborted) break;
        fullOutput += chunk;
        onEvent({ type: 'chunk', text: chunk });
      }

      await persistence.updateRequest(request.id, {
        status: 'completed',
        output: fullOutput,
      });

      this.logger.log(`✅ [StoryGen:single] DONE — ${fullOutput.length} chars | requestId: ${request.id}`);

      onEvent({ type: 'done', requestId: request.id, totalChars: fullOutput.length });
    } catch (err: unknown) {
      const status =
        err instanceof Error && err.name === 'AbortError' ? 'canceled' : 'failed';
      const message = err instanceof Error ? err.message : 'Generation failed';
      await persistence.updateRequest(request.id, {
        status,
        error: status === 'canceled' ? null : message,
      });
      this.logger.warn(`⚠️  [StoryGen:single] status=${status} | ${message}`);
      throw err;
    }
  }

  // ─── Segmented pipeline ────────────────────────────────────────────────────

  private async runSegmented(
    input: StreamStoryGenerationInput,
    storySoFar: string,
    systemPrompt: string,
    targetChars: number,
    onEvent: StreamEventCallback,
    persistence: StoryPersistence,
  ): Promise<void> {
    const totalSegments = Math.ceil(targetChars / SEGMENT_CHARS);

    this.logger.log(`📚 [StoryGen:seg] totalSegments: ${totalSegments} | SEGMENT_CHARS: ${SEGMENT_CHARS}`);

    const request = await persistence.createRequest({
      novelId: input.novelId,
      sourceEpisodeId: input.episodeId ?? null,
      prompt: input.userMessage,
      maxTokens: TOKENS_PER_SEGMENT * totalSegments,
      temperature: input.temperature ?? null,
    });

    let fullOutput = '';
    let prevTail = '';

    try {
      for (let seg = 1; seg <= totalSegments; seg++) {
        onEvent({ type: 'segment_start', segment: seg, total: totalSegments });

        const segmentPrompt = this.buildSegmentPrompt(
          input.userMessage,
          storySoFar,
          seg,
          totalSegments,
          prevTail,
        );

        this.logger.log(`📄 [StoryGen:seg] segment [${seg}/${totalSegments}] — prompt: ${segmentPrompt.length} chars`);

        let segmentOutput = '';

        const stream = this.ai.stream(systemPrompt, segmentPrompt, {
          temperature: input.temperature,
          maxOutputTokens: TOKENS_PER_SEGMENT,
          ...(input.signal ? { signal: input.signal } : {}),
        });

        for await (const chunk of stream) {
          if (input.signal?.aborted) break;
          segmentOutput += chunk;
          fullOutput += chunk;
          onEvent({ type: 'chunk', text: chunk });
        }

        if (input.signal?.aborted) break;

        prevTail = segmentOutput.slice(-TAIL_CHARS);
        this.logger.log(`✅ [StoryGen:seg] segment [${seg}/${totalSegments}] — ${segmentOutput.length} chars`);
        onEvent({ type: 'segment_done', segment: seg, chars: segmentOutput.length });
      }

      await persistence.updateRequest(request.id, {
        status: 'completed',
        output: fullOutput,
      });

      this.logger.log(`✅ [StoryGen:seg] ALL DONE — total: ${fullOutput.length} chars | requestId: ${request.id}`);
      onEvent({ type: 'done', requestId: request.id, totalChars: fullOutput.length });
    } catch (err: unknown) {
      const status =
        err instanceof Error && err.name === 'AbortError' ? 'canceled' : 'failed';
      const message = err instanceof Error ? err.message : 'Generation failed';
      await persistence.updateRequest(request.id, {
        status,
        error: status === 'canceled' ? null : message,
      });
      this.logger.warn(`⚠️  [StoryGen:seg] status=${status} | ${message}`);
      throw err;
    }
  }

  // ─── Prompt builders ──────────────────────────────────────────────────────

  private buildSystemPrompt(
    novel: { title: string; summary: string | null },
    context: string,
    novelContext: { writingStyle?: string | null },
  ): string {
    const writingStyleSection = novelContext.writingStyle?.trim()
      ? `\n\n## ✅ สไตล์และน้ำเสียงที่ต้องใช้ (บังคับเด็ดขาด — ห้ามเบี่ยงเป็นอย่างอื่น)\n${novelContext.writingStyle.trim()}`
      : `\n\n## ✅ น้ำเสียงเริ่มต้น (ไม่ได้กำหนดไว้)\n- ใช้น้ำเสียงกลาง สุภาพ อ่านง่ายแต่มีความเข้มแข็ง\n- อารมณ์ประผมกันอย่างสมดุลย์: สนุก, ลุ้น, ตื่นเต้น, อบอุ่น, ความขัดแย้ง, เศร้าโดยมีเหตุผล`;

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
