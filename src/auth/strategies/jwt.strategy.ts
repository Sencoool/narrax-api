import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'fallback-secret',
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    // ส่งกลับข้อมูลที่จะไปอยู่ใน req.user
    return { id: user.id, email: user.email, name: user.name };
  }
}
