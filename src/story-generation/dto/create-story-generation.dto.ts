import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createStoryGenerationSchema = z
  .object({
    novelId: z.string().uuid().optional(),
    prompt: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
  })
  .meta({ id: 'CreateStoryGeneration' });

export class CreateStoryGenerationDto extends createZodDto(
  createStoryGenerationSchema,
) {}
