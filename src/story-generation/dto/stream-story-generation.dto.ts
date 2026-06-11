import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const streamStoryGenerationSchema = z
  .object({
    novelId: z.string().uuid('novelId ต้องเป็น UUID'),
    episodeId: z.string().uuid().optional(),
    userMessage: z
      .string()
      .min(1, 'กรุณาระบุ prompt')
      .max(2000, 'prompt ยาวเกินไป'),
    mode: z.enum(['co_author', 'autopilot']).default('co_author'),
    temperature: z.number().min(0).max(2).optional(),
    maxOutputTokens: z.number().int().positive().max(8192).optional(),
  })
  .meta({ id: 'StreamStoryGeneration' });

export class StreamStoryGenerationDto extends createZodDto(
  streamStoryGenerationSchema,
) {}
