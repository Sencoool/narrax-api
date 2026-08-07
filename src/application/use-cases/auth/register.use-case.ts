import { Injectable, Inject } from '@nestjs/common';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface.js';
import {
  USER_REPOSITORY,
} from '../../../domain/repositories/user.repository.interface.js';
import type { CreateUserData } from '../../../domain/repositories/user.repository.interface.js';
import type { IPasswordHasher } from '../../ports/password-hasher.port.js';
import { PASSWORD_HASHER } from '../../ports/password-hasher.port.js';
import { UserEntity } from '../../../domain/entities/user.entity.js';
import { DomainConflictError } from '../../../domain/errors/domain-errors.js';

export interface RegisterInput {
  email: string;
  name: string | null;
  password: string;
}

/**
 * Registers a new user with email/password.
 * Throws DomainConflictError if the email is already taken.
 */
@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly hasher: IPasswordHasher,
  ) {}

  async execute(input: RegisterInput): Promise<UserEntity> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new DomainConflictError(
        `อีเมล "${input.email}" ถูกใช้งานแล้ว`,
      );
    }

    const passwordHash = await this.hasher.hash(input.password);

    const data: CreateUserData = {
      email: input.email,
      name: input.name,
      passwordHash,
      googleId: null,
    };

    return this.userRepo.create(data);
  }
}
