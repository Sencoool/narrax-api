import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createEpisodeSchema = z
  .object({
    title: z.string().min(1, 'ชื่อตอนไม่ควรว่างเปล่า').max(200),
    content: z.string().min(1, 'เนื้อหาตอนไม่ควรว่างเปล่า'),
    order: z.number().int().positive().optional(),
    isPublished: z.boolean().default(false),
  })
  .meta({ id: 'CreateEpisode' });

export class CreateEpisodeDto extends createZodDto(createEpisodeSchema) {}
