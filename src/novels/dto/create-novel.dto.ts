import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createNovelSchema = z
  .object({
    title: z.string().min(1, 'ชื่อนิยายไม่ควรว่างเปล่า').max(200),
    summary: z.string().max(2000).optional(),
    status: z.enum(['draft', 'unpublished', 'published']).default('draft'),
    tags: z.array(z.string().min(1)).optional(),
  })
  .meta({ id: 'CreateNovel' });

export class CreateNovelDto extends createZodDto(createNovelSchema) {}
