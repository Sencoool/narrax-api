/**
 * User domain entity.
 *
 * NOTE: `passwordHash` is intentionally optional — users who signed up via
 * Google OAuth will not have a password. It is NEVER serialised to API responses;
 * that responsibility belongs to the presentation layer's response DTOs.
 */
export interface UserProps {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  googleId: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Tokens issued before this instant are rejected by JwtStrategy. */
  tokensValidFrom: Date | null;
}

export class UserEntity {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  /** Hashed password — never expose in responses. */
  readonly passwordHash: string | null;
  readonly googleId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Set by "log out everywhere"; every earlier token stops working. */
  readonly tokensValidFrom: Date | null;

  constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.name = props.name;
    this.passwordHash = props.passwordHash;
    this.googleId = props.googleId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.tokensValidFrom = props.tokensValidFrom;
  }

  /** Returns true when the user registered via Google OAuth (no password). */
  isGoogleUser(): boolean {
    return this.googleId !== null && this.passwordHash === null;
  }

  /** Returns true when the user has a local password (may also have a googleId). */
  hasPassword(): boolean {
    return this.passwordHash !== null;
  }

  /**
   * Returns a safe snapshot of the user — no passwordHash.
   * Use this shape whenever you need a plain object for logging or API response.
   */
  toSafeObject(): Omit<UserProps, 'passwordHash' | 'tokensValidFrom'> {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      googleId: this.googleId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
