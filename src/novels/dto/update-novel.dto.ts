import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateNovelSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    summary: z.string().max(2000).optional(),
    status: z.enum(['draft', 'unpublished', 'published']).optional(),
    tags: z.array(z.string()).optional(),
  })
  .meta({ id: 'UpdateNovel' });

export class UpdateNovelDto extends createZodDto(updateNovelSchema) { }
