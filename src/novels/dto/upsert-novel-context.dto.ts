import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const characterSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  role: z
    .enum(['protagonist', 'antagonist', 'supporting', 'other'])
    .default('other'),
});

export const upsertNovelContextSchema = z
  .object({
    characters: z.array(characterSchema).optional(),
    worldBuilding: z.string().max(1000).optional(),
    plotOutline: z.string().max(5000).optional(),
    writingStyle: z.string().max(1000).optional(),
  })
  .meta({ id: 'UpsertNovelContext' });

export class UpsertNovelContextDto extends createZodDto(
  upsertNovelContextSchema,
) {}
