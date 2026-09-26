import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { FindOneUserUseCase } from '../../application/use-cases/users/find-one-user.use-case';
import type { UserEntity } from '../../domain/entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  /** Issued-at, in seconds. @nestjs/jwt sets this unless `noTimestamp` was used. */
  iat?: number;
}

/**
 * A token is revoked when it was issued before the user's `tokensValidFrom`
 * stamp, which `POST /auth/logout-all` moves to "now".
 *
 * `iat` has one-second resolution, so a token minted in the same second as the
 * revocation can still pass — acceptable for a "log out everywhere" action.
 * A token with no `iat` cannot prove it postdates the revocation, so once a user
 * has ever revoked, it is rejected.
 */
export function isTokenRevoked(
  iat: number | undefined,
  tokensValidFrom: Date | null,
): boolean {
  if (!tokensValidFrom) return false;
  if (typeof iat !== 'number') return true;
  return iat * 1000 < tokensValidFrom.getTime();
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly findOneUserUseCase: FindOneUserUseCase,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_SECRET is not set -- refusing to sign tokens with the built-in fallback secret',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    let user: UserEntity;
    try {
      user = await this.findOneUserUseCase.execute(payload.sub);
    } catch {
      throw new UnauthorizedException();
    }

    if (isTokenRevoked(payload.iat, user.tokensValidFrom)) {
      throw new UnauthorizedException();
    }

    // Return the safe shape — this becomes req.user on all guarded routes
    return { id: user.id, email: user.email, name: user.name };
  }
}
