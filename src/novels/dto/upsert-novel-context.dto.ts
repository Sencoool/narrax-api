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
    worldBuilding: z
      .object({
        setting: z.string().optional(),
        time: z.string().optional(),
        locations: z.array(z.string()).optional(),
        rules: z.string().optional(),
      })
      .optional(),
    plotOutline: z.string().max(5000).optional(),
    writingStyle: z.string().max(1000).optional(),
  })
  .meta({ id: 'UpsertNovelContext' });

export class UpsertNovelContextDto extends createZodDto(
  upsertNovelContextSchema,
) {}
