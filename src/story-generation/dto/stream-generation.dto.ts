import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Maximum Thai characters the system will ever generate in one request */
export const MAX_TARGET_CHARS = 15_000;

/** Below this threshold → single-shot pipeline; at or above → segmented pipeline */
export const SINGLE_SHOT_THRESHOLD = 2_500;

/** A single turn in the conversation history */
export const conversationTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(6000),
});

export const streamGenerationSchema = z
  .object({
    novelId: z.string().uuid('novelId ต้องเป็น UUID'),
    episodeId: z.string().uuid().optional(),
    userMessage: z
      .string()
      .min(1, 'กรุณาระบุ prompt')
      .max(3000, 'prompt ยาวเกินไป'),
    /**
     * เนื้อหาปัจจุบันในตัว editor (HTML) — ส่งมาจาก frontend
     * ใช้เป็น context "เนื้อเรื่องที่เขียนไปแล้ว" เพื่อให้ AI ต่อเรื่องได้ถูกต้อง
     */
    currentContent: z.string().optional(),
    /**
     * ประวัติการสนทนา (สูงสุด 20 รอบ) — ส่งมาจาก frontend chat thread
     * ใช้ให้ AI เข้าใจ context ของการสนทนาก่อนหน้า เช่น "ทำให้ยาวขึ้น" "เปลี่ยนน้ำเสียง"
     */
    conversationHistory: z.array(conversationTurnSchema).max(20).optional(),
    /**
     * จำนวนตัวอักษรไทยที่ต้องการ (ผู้ใช้กำหนดความยาว)
     * - ไม่ระบุ → ระบบใช้ค่าเริ่มต้น 2,500 ตัวอักษร
     * - ≤ 2,500 → single-shot pipeline (เร็ว)
     * - > 2,500 → segmented pipeline (หลาย segment อัตโนมัติ)
     * - สูงสุด 15,000 ตัวอักษร
     */
    targetChars: z
      .number()
      .int()
      .positive('targetChars ต้องเป็นจำนวนบวก')
      .optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxContextTokens: z.number().int().min(512).max(131072).optional(),
    modelId: z.string().uuid().optional(),
  })
  .meta({ id: 'StreamGeneration' });

export type ConversationTurn = z.infer<typeof conversationTurnSchema>;
export class StreamGenerationDto extends createZodDto(streamGenerationSchema) {}
