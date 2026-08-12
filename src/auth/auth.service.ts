import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ValidateGoogleUserUseCase } from '../application/use-cases/auth/validate-google-user.use-case.js';
import type { ValidateGoogleUserInput } from '../application/use-cases/auth/validate-google-user.use-case.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly validateGoogleUserUseCase: ValidateGoogleUserUseCase,
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

  async validateGoogleUser(input: ValidateGoogleUserInput) {
    return this.validateGoogleUserUseCase.execute(input);
  }
}
