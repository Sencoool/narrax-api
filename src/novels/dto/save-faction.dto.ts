import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const SaveFactionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
  arcLabel: z.string().max(200).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export class SaveFactionDto extends createZodDto(SaveFactionSchema) {}
