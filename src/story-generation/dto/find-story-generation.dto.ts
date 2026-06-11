import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const findStoryGenerationSchema = z
  .object({
    status: z
      .enum([
        'pending',
        'queued',
        'processing',
        'completed',
        'failed',
        'canceled',
      ])
      .optional(),
  })
  .meta({ id: 'FindStoryGeneration' });

export class FindStoryGenerationDto extends createZodDto(
  findStoryGenerationSchema,
) {}
