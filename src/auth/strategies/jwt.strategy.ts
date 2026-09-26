import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { FindOneUserUseCase } from '../../application/use-cases/users/find-one-user.use-case';

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

  async validate(payload: { sub: string; email: string }) {
    try {
      const user = await this.findOneUserUseCase.execute(payload.sub);
      // Return the safe shape — this becomes req.user on all guarded routes
      return { id: user.id, email: user.email, name: user.name };
    } catch {
      throw new UnauthorizedException();
    }
  }
}
