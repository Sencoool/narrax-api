import type { User as PrismaUser } from '@prisma/client';
import { UserEntity } from '../../../domain/entities/user.entity.js';

/**
 * Maps between Prisma's generated `User` model and the domain `UserEntity`.
 * This is the only place in the codebase that knows about both shapes.
 */
export class UserMapper {
  /**
   * Prisma → Domain.
   * `password` in Prisma is renamed to `passwordHash` in the domain
   * to make its sensitivity explicit.
   */
  static toDomain(raw: PrismaUser): UserEntity {
    return new UserEntity({
      id: raw.id,
      email: raw.email,
      name: raw.name,
      passwordHash: raw.password,
      googleId: raw.googleId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      tokensValidFrom: raw.tokensValidFrom,
    });
  }
}
