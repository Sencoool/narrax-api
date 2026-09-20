import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createEpisodeSchema = z
  .object({
    title: z.string().min(1, 'ชื่อตอนไม่ควรว่างเปล่า').max(200),
    content: z.string().optional(),
    order: z.number().int().positive().optional(),
    isPublished: z.boolean().default(false),
    /** Character names the AI is allowed to use for this episode */
    cast: z.array(z.string().min(1)).optional(),
  })
  .meta({ id: 'CreateEpisode' });


export class CreateEpisodeDto extends createZodDto(createEpisodeSchema) { }
