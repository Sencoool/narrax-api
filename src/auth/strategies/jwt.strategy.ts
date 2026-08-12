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
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'fallback-secret',
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
