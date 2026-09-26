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
    /**
     * `null` clears the stored value; omitting the field leaves it untouched.
     * Both are meaningful and must not be collapsed into one another.
     */
    characters: z.array(characterSchema).nullable().optional(),
    worldBuilding: z.string().max(1000).nullable().optional(),
    plotOutline: z.string().max(5000).nullable().optional(),
    writingStyle: z.string().max(1000).nullable().optional(),
  })
  .meta({ id: 'UpsertNovelContext' });

export class UpsertNovelContextDto extends createZodDto(
  upsertNovelContextSchema,
) {}
