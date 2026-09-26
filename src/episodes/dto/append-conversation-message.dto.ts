import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Body of POST /episodes/:id/conversation.
 *
 * Mirrors the ChatMessage status values the web client persists, so an invalid
 * role/status is rejected with a 400 instead of being written to the database
 * and echoed back to the client.
 */
export const appendConversationMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(20_000),
    status: z
      .enum(['streaming', 'done', 'error', 'accepted', 'rejected'])
      .optional(),
  })
  .meta({ id: 'AppendConversationMessage' });

export class AppendConversationMessageDto extends createZodDto(
  appendConversationMessageSchema,
) {}
