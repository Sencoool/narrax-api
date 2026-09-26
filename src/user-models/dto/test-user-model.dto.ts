import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { modelProviderSchema } from './create-user-model.dto.js';

export const testUserModelSchema = z
  .object({
    id: z.string().uuid().optional(),
    provider: modelProviderSchema.optional(),
    modelName: z.string().min(1).optional(),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
  })
  .meta({ id: 'TestUserModel' });

export class TestUserModelDto extends createZodDto(testUserModelSchema) {}
