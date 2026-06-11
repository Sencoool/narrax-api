import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const findNovelsSchema = z
  .object({
    status: z.enum(['draft', 'unpublished', 'published']).optional(),
    authorId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .meta({ id: 'FindNovels' });

export class FindNovelsDto extends createZodDto(findNovelsSchema) {}
