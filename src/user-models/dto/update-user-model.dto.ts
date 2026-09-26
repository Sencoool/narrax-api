import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { modelProviderSchema } from './create-user-model.dto.js';

export const updateUserModelSchema = z
  .object({
    label: z.string().min(1).max(100).optional(),
    provider: modelProviderSchema.optional(),
    modelName: z.string().min(1).optional(),
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional().or(z.literal('')),
    isDefault: z.boolean().optional(),
  })
  .meta({ id: 'UpdateUserModel' });

export class UpdateUserModelDto extends createZodDto(updateUserModelSchema) {}
