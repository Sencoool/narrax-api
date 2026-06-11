import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateStoryGenerationSchema = z
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
    output: z.string().min(1).optional(),
    error: z.string().min(1).optional(),
    externalJobId: z.string().min(1).optional(),
  })
  .meta({ id: 'UpdateStoryGeneration' });

export class UpdateStoryGenerationDto extends createZodDto(
  updateStoryGenerationSchema,
) {}
