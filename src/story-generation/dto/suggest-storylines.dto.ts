import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const suggestStorylinesSchema = z.object({
  novelId: z.string().uuid(),
  episodeId: z.string().uuid().optional(),
});

export class SuggestStorylinesDto extends createZodDto(
  suggestStorylinesSchema,
) {}
