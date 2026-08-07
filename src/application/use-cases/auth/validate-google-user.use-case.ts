import { Injectable, Inject } from '@nestjs/common';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface.js';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface.js';
import { UserEntity } from '../../../domain/entities/user.entity.js';

export interface ValidateGoogleUserInput {
  googleId: string;
  email: string;
  name: string;
}

/**
 * Finds or creates a user from Google OAuth profile data.
 *
 * Strategy (mirrors existing AuthService.validateGoogleUser):
 * 1. Look up by googleId → return if found
 * 2. Look up by email → link googleId to existing account if found
 * 3. Create a new account with google credentials
 */
@Injectable()
export class ValidateGoogleUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: ValidateGoogleUserInput): Promise<UserEntity> {
    // 1. Find by googleId
    let user = await this.userRepo.findByGoogleId(input.googleId);
    if (user) return user;

    // 2. Find existing account by email and link googleId
    user = await this.userRepo.findByEmail(input.email);
    if (user) {
      return this.userRepo.update(user.id, { googleId: input.googleId });
    }

    // 3. Create new Google-only account
    return this.userRepo.create({
      email: input.email,
      name: input.name,
      passwordHash: null,
      googleId: input.googleId,
    });
  }
}
