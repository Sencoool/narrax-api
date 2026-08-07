import { DomainValidationError } from '../errors/domain-errors.js';

/**
 * Allowed publication states for a Novel.
 * Mirrors the `NovelStatus` enum in the Prisma schema.
 */
export type NovelStatusValue = 'draft' | 'unpublished' | 'published';

const VALID_STATUSES: NovelStatusValue[] = ['draft', 'unpublished', 'published'];

/**
 * Value object that wraps a NovelStatus string and validates it.
 */
export class NovelStatus {
  readonly value: NovelStatusValue;

  private constructor(value: NovelStatusValue) {
    this.value = value;
  }

  static create(raw: string): NovelStatus {
    if (!VALID_STATUSES.includes(raw as NovelStatusValue)) {
      throw new DomainValidationError(
        `สถานะนิยายไม่ถูกต้อง: "${raw}" — ต้องเป็น ${VALID_STATUSES.join(' | ')}`,
      );
    }
    return new NovelStatus(raw as NovelStatusValue);
  }

  static draft(): NovelStatus {
    return new NovelStatus('draft');
  }

  static unpublished(): NovelStatus {
    return new NovelStatus('unpublished');
  }

  static published(): NovelStatus {
    return new NovelStatus('published');
  }

  isDraft(): boolean {
    return this.value === 'draft';
  }

  isPublished(): boolean {
    return this.value === 'published';
  }

  equals(other: NovelStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
