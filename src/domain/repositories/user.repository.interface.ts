import type { UserEntity } from '../entities/user.entity.js';

export interface CreateUserData {
  email: string;
  name: string | null;
  passwordHash: string | null;
  googleId: string | null;
}

export interface UpdateUserData {
  email?: string;
  name?: string | null;
  googleId?: string | null;
}

/**
 * Port (interface) for user persistence.
 * The concrete implementation lives in the infrastructure layer (Prisma).
 */
export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByGoogleId(googleId: string): Promise<UserEntity | null>;
  findAll(): Promise<UserEntity[]>;
  create(data: CreateUserData): Promise<UserEntity>;
  update(id: string, data: UpdateUserData): Promise<UserEntity>;
  delete(id: string): Promise<void>;
}

/** NestJS DI injection token for IUserRepository. */
export const USER_REPOSITORY = Symbol('IUserRepository');
