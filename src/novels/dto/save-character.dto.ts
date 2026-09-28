import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const SaveCharacterSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  role: z.string().max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  introducedAtOrder: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  factionIds: z.array(z.string().uuid()).default([]),
});

export class SaveCharacterDto extends createZodDto(SaveCharacterSchema) {}
