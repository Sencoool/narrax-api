import { createZodDto } from 'nestjs-zod';
import { createUserSchema } from './create-user.dto';

export const updateUserSchema = createUserSchema
  .partial()
  .meta({ id: 'UpdateUser' });

export class UpdateUserDto extends createZodDto(updateUserSchema) {}
