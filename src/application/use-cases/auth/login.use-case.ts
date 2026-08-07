import { Injectable, Inject } from '@nestjs/common';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface.js';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface.js';
import type { IPasswordHasher } from '../../ports/password-hasher.port.js';
import { PASSWORD_HASHER } from '../../ports/password-hasher.port.js';
import { UserEntity } from '../../../domain/entities/user.entity.js';
import { DomainUnauthorizedError } from '../../../domain/errors/domain-errors.js';

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Validates email/password credentials.
 * Returns the UserEntity on success.
 * Throws DomainUnauthorizedError for any credential failure
 * (intentionally same message for both "not found" and "wrong password"
 * to prevent email enumeration).
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly hasher: IPasswordHasher,
  ) {}

  async execute(input: LoginInput): Promise<UserEntity> {
    const user = await this.userRepo.findByEmail(input.email);

    // No user found — same error as wrong password (prevents email enumeration)
    if (!user || !user.hasPassword()) {
      throw new DomainUnauthorizedError();
    }

    const isValid = await this.hasher.verify(
      user.passwordHash!,
      input.password,
    );

    if (!isValid) {
      throw new DomainUnauthorizedError();
    }

    return user;
  }
}
