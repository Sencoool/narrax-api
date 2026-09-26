import { Inject, Injectable } from '@nestjs/common';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface.js';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface.js';

/**
 * "Log out everywhere": revokes every JWT issued to the user before now.
 *
 * The repository stamps `User.tokensValidFrom` with the current time, and
 * JwtStrategy rejects any token whose `iat` predates that value — so the
 * caller's own token stops working too, which is the point.
 */
@Injectable()
export class RevokeAllTokensUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    await this.userRepo.revokeTokens(userId);
  }
}
