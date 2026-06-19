import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Maximum Thai characters the system will ever generate in one request */
export const MAX_TARGET_CHARS = 15_000;

/** Below this threshold → single-shot pipeline; at or above → segmented pipeline */
export const SINGLE_SHOT_THRESHOLD = 2_500;

export const streamGenerationSchema = z
  .object({
    novelId: z.string().uuid('novelId ต้องเป็น UUID'),
    episodeId: z.string().uuid().optional(),
    userMessage: z
      .string()
      .min(1, 'กรุณาระบุ prompt')
      .max(3000, 'prompt ยาวเกินไป'),
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
  })
  .meta({ id: 'StreamGeneration' });

export class StreamGenerationDto extends createZodDto(streamGenerationSchema) { }
