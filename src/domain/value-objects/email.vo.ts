import { DomainValidationError } from '../errors/domain-errors.js';

/**
 * Value object representing a valid e-mail address.
 * Immutable after construction — equality is by value, not identity.
 */
export class Email {
  private static readonly PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /** The normalised (lower-cased, trimmed) address string. */
  readonly value: string;

  private constructor(raw: string) {
    this.value = raw.trim().toLowerCase();
  }

  static create(raw: string): Email {
    if (!raw || !Email.PATTERN.test(raw.trim())) {
      throw new DomainValidationError(`รูปแบบอีเมลไม่ถูกต้อง: "${raw}"`);
    }
    return new Email(raw);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
