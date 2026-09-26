import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Recognises the caller when a valid bearer token is present, and lets the request
 * through as anonymous when it is not.
 *
 * Used by read routes that serve published work to anyone while still allowing the
 * author to see their own drafts. An expired or malformed token is treated as
 * anonymous rather than as an error: the reader simply sees published content.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(_err: unknown, user: TUser): TUser | undefined {
    return user ?? undefined;
  }
}
