import { Injectable, Inject } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
  UpdateUserData,
} from '../../../domain/repositories/user.repository.interface.js';
import { UserEntity } from '../../../domain/entities/user.entity.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface UpdateUserInput {
  email?: string;
  name?: string | null;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(id: string, input: UpdateUserInput): Promise<UserEntity> {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      throw new DomainNotFoundError('ผู้ใช้', id);
    }

    const data: UpdateUserData = {
      email: input.email,
      name: input.name,
    };

    return this.userRepo.update(id, data);
  }
}
