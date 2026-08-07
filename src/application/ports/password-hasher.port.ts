/**
 * Port (interface) for password hashing and verification.
 *
 * The concrete implementation (Argon2PasswordHasher) lives in the
 * infrastructure/auth layer and wraps the `argon2` npm package.
 *
 * Separating this port from the domain lets use-cases perform auth logic
 * without importing argon2 — which has native bindings and is hard to mock.
 */
export interface IPasswordHasher {
  /**
   * Hashes a plain-text password.
   * Returns the Argon2 hash string (includes salt, algorithm params).
   */
  hash(plainText: string): Promise<string>;

  /**
   * Verifies a plain-text password against a previously hashed value.
   * Returns true if they match.
   */
  verify(hash: string, plainText: string): Promise<boolean>;
}

/** NestJS DI injection token for IPasswordHasher. */
export const PASSWORD_HASHER = Symbol('IPasswordHasher');
