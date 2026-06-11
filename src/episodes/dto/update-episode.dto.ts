import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateEpisodeSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).optional(),
    order: z.number().int().positive().optional(),
    isPublished: z.boolean().optional(),
  })
  .meta({ id: 'UpdateEpisode' });

export class UpdateEpisodeDto extends createZodDto(updateEpisodeSchema) {}
