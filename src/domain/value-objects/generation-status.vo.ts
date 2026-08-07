import { DomainValidationError } from '../errors/domain-errors.js';

/**
 * Allowed status values for a StoryGenerationRequest.
 * Mirrors the `GenerationStatus` enum in the Prisma schema.
 */
export type GenerationStatusValue =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'canceled';

const VALID_STATUSES: GenerationStatusValue[] = [
  'pending',
  'queued',
  'processing',
  'completed',
  'failed',
  'canceled',
];

/**
 * Value object that wraps a GenerationStatus string and validates it.
 */
export class GenerationStatus {
  readonly value: GenerationStatusValue;

  private constructor(value: GenerationStatusValue) {
    this.value = value;
  }

  static create(raw: string): GenerationStatus {
    if (!VALID_STATUSES.includes(raw as GenerationStatusValue)) {
      throw new DomainValidationError(
        `สถานะการสร้างเนื้อหาไม่ถูกต้อง: "${raw}" — ต้องเป็น ${VALID_STATUSES.join(' | ')}`,
      );
    }
    return new GenerationStatus(raw as GenerationStatusValue);
  }

  static pending(): GenerationStatus {
    return new GenerationStatus('pending');
  }

  static processing(): GenerationStatus {
    return new GenerationStatus('processing');
  }

  static completed(): GenerationStatus {
    return new GenerationStatus('completed');
  }

  static failed(): GenerationStatus {
    return new GenerationStatus('failed');
  }

  static canceled(): GenerationStatus {
    return new GenerationStatus('canceled');
  }

  isTerminal(): boolean {
    return (
      this.value === 'completed' ||
      this.value === 'failed' ||
      this.value === 'canceled'
    );
  }

  isInProgress(): boolean {
    return this.value === 'queued' || this.value === 'processing';
  }

  equals(other: GenerationStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
