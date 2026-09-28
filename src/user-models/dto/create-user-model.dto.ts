import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const modelProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'mistral',
  'ollama',
  'custom',
]);

export const createUserModelSchema = z
  .object({
    label: z.string().min(1, 'Label cannot be empty').max(100),
    provider: modelProviderSchema,
    modelName: z.string().min(1, 'Model name cannot be empty'),
    apiKey: z.string().optional(),
    baseUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
    isDefault: z.boolean().optional().default(false),
    contextTokens: z.number().int().min(512).max(131072).optional(),
  })
  .meta({ id: 'CreateUserModel' });

export class CreateUserModelDto extends createZodDto(createUserModelSchema) {}
