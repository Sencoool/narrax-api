import { Injectable, Inject } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../domain/repositories/user.repository.interface.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

@Injectable()
export class DeleteUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      throw new DomainNotFoundError('ผู้ใช้', id);
    }
    await this.userRepo.delete(id);
  }
}
