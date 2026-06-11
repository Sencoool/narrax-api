import { Body, Controller, MessageEvent, Post, Res, Sse } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Observable, Subject } from 'rxjs';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/rag.service';
import { StreamStoryGenerationDto } from './dto/stream-story-generation.dto';

@ApiTags('story-generations')
@Controller('story-generations')
export class StoryGenerationStreamController {
  constructor(
    private readonly aiService: AiService,
    private readonly ragService: RagService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * SSE endpoint สำหรับ AI เขียนนิยายแบบ real-time streaming
   *
   * ใช้ @Sse() decorator ของ NestJS สำหรับ Server-Sent Events
   * Frontend ใช้ EventSource API ในการรับ stream
   *
   * Flow:
   * 1. รับ novelId + userMessage
   * 2. RAG: ดึง context (ตัวละคร + เนื้อเรื่องที่เกี่ยวข้อง)
   * 3. สร้าง system prompt ภาษาไทย
   * 4. Stream text chunks ไปยัง client
   * 5. บันทึก output ลง StoryGenerationRequest
   */
  @Post('stream')
  @Sse()
  @ApiOperation({
    summary: 'AI เขียนนิยายแบบ streaming (SSE)',
    description:
      'ส่ง text chunks แบบ real-time ผ่าน Server-Sent Events พร้อม RAG memory จากนิยาย',
  })
  streamGeneration(
    @Body() body: StreamStoryGenerationDto,
    @Res() res: Response,
  ): Observable<MessageEvent> {
    // ตั้งค่า SSE headers
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    const subject = new Subject<MessageEvent>();

    // เรียก async pipeline โดยไม่ block
    this.runStreamPipeline(body, subject).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      subject.next({
        data: JSON.stringify({ type: 'error', message }),
      });
      subject.complete();
    });

    return subject.asObservable();
  }

  private async runStreamPipeline(
    body: StreamStoryGenerationDto,
    subject: Subject<MessageEvent>,
  ): Promise<void> {
    const { novelId, userMessage, mode, temperature, maxOutputTokens } = body;

    // 1. ดึง Novel + RAG context
    const [novel, context] = await Promise.all([
      this.prisma.novel.findUniqueOrThrow({
        where: { id: novelId },
        select: { id: true, title: true, summary: true },
      }),
      this.ragService.buildContext(novelId, userMessage),
    ]);

    // 2. สร้าง system prompt ภาษาไทย
    const systemPrompt = this.buildSystemPrompt(novel, context, mode);

    // 3. บันทึก request ลง DB
    const generationRequest = await this.prisma.storyGenerationRequest.create({
      data: {
        novelId,
        prompt: userMessage,
        mode,
        status: 'processing',
        provider: 'google',
        model: 'gemini-2.0-flash',
        temperature: temperature ?? null,
        maxTokens: maxOutputTokens ?? null,
      },
    });

    // 4. Stream text จาก Gemini
    let fullOutput = '';
    try {
      const stream = this.aiService.generateStream(systemPrompt, userMessage, {
        temperature,
        maxOutputTokens,
      });

      for await (const chunk of stream) {
        fullOutput += chunk;
        subject.next({
          data: JSON.stringify({ type: 'chunk', text: chunk }),
        });
      }

      // 5. บันทึก output ที่สมบูรณ์
      await this.prisma.storyGenerationRequest.update({
        where: { id: generationRequest.id },
        data: { status: 'completed', output: fullOutput },
      });

      subject.next({
        data: JSON.stringify({
          type: 'done',
          requestId: generationRequest.id,
          totalLength: fullOutput.length,
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

  /**
   * สร้าง system prompt ที่รวม context ของนิยายไว้
   */
  private buildSystemPrompt(
    novel: { title: string; summary?: string | null },
    context: string,
    mode: 'co_author' | 'autopilot',
  ): string {
    const modeInstruction =
      mode === 'autopilot'
        ? `เขียนเนื้อเรื่องต่อโดยอัตโนมัติ ให้ยาวและละเอียด อย่างน้อย 3-5 ย่อหน้า`
        : `ช่วยผู้เขียนต่อเรื่อง ยึดตาม prompt และสไตล์ที่กำหนด`;

    const contextSection = context
      ? `\n\n---\n## ข้อมูลนิยาย\n${context}\n---`
      : '';

    return `คุณเป็นผู้ช่วยเขียนนิยายไทยชั้นเยี่ยม ที่เชี่ยวชาญการแต่งเรื่องแนวต่างๆ

## นิยาย: ${novel.title}
${novel.summary ? `สรุปเรื่อง: ${novel.summary}` : ''}${contextSection}

## คำแนะนำ
- ${modeInstruction}
- รักษาความต่อเนื่องของตัวละครและเนื้อเรื่องตาม context ที่ให้ไว้
- ใช้ภาษาไทยที่ถูกต้องและสละสลวย
- บรรยายฉากและอารมณ์ให้ชัดเจน
- ห้ามออกนอกเรื่องหรือเพิ่มตัวละครใหม่โดยไม่จำเป็น
- ตอบเป็นเนื้อเรื่องโดยตรง ไม่ต้องอธิบายว่ากำลังทำอะไร`;
  }
}
