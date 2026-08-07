/**
 * Domain-level errors for the Plot Weaver application.
 *
 * These are pure TypeScript classes — no framework dependencies.
 * Infrastructure and presentation layers map these to HTTP status codes.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when a required resource cannot be found. Maps to HTTP 404. */
export class DomainNotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`ไม่พบ ${resource} id: ${id}`);
  }
}

/** Thrown when the caller lacks permission to act on a resource. Maps to HTTP 403. */
export class DomainForbiddenError extends DomainError {
  constructor(message = 'คุณไม่มีสิทธิ์ดำเนินการนี้') {
    super(message);
  }
}

/** Thrown when domain invariants are violated (e.g., invalid field value). Maps to HTTP 422. */
export class DomainValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/** Thrown when attempting to create a resource that already exists. Maps to HTTP 409. */
export class DomainConflictError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/** Thrown when credentials are invalid (email/password mismatch). Maps to HTTP 401. */
export class DomainUnauthorizedError extends DomainError {
  constructor(message = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง') {
    super(message);
  }
}
