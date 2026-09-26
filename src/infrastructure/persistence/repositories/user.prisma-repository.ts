import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  IUserRepository,
  CreateUserData,
  UpdateUserData,
} from '../../../domain/repositories/user.repository.interface.js';
import { UserEntity } from '../../../domain/entities/user.entity.js';
import { UserMapper } from '../mappers/user.mapper.js';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findUnique({ where: { id } });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findUnique({ where: { email } });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findByGoogleId(googleId: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findUnique({ where: { googleId } });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findAll(): Promise<UserEntity[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => UserMapper.toDomain(row));
  }

  async create(data: CreateUserData): Promise<UserEntity> {
    const raw = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        // Domain uses `passwordHash`; Prisma column is `password`
        password: data.passwordHash,
        googleId: data.googleId,
      },
    });
    return UserMapper.toDomain(raw);
  }

  async update(id: string, data: UpdateUserData): Promise<UserEntity> {
    const raw = await this.prisma.user.update({
      where: { id },
      data: {
        email: data.email,
        name: data.name,
        googleId: data.googleId,
      },
    });
    return UserMapper.toDomain(raw);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
