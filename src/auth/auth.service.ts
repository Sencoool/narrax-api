import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  generateJwt(user: { id: string; email: string }) {
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  async validateGoogleUser(googleUser: {
    googleId: string;
    email: string;
    name: string;
  }) {
    let user = await this.usersService.findByGoogleId(googleUser.googleId);

    if (!user) {
      user = await this.usersService.findByEmail(googleUser.email);

      if (user) {
        user = await this.usersService.linkGoogleId(
          user.id,
          googleUser.googleId,
        );
      } else {
        user = await this.usersService.createWithGoogle(
          googleUser.email,
          googleUser.name,
          googleUser.googleId,
        );
      }
    }

    return user;
  }
}
