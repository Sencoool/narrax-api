import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  IUserModelConfigRepository,
  CreateUserModelConfigInput,
  UpdateUserModelConfigInput,
} from '../../../domain/repositories/user-model-config.repository.interface.js';
import { UserModelConfigEntity } from '../../../domain/entities/user-model-config.entity.js';
import { UserModelConfigMapper } from '../mappers/user-model-config.mapper.js';

@Injectable()
export class PrismaUserModelConfigRepository implements IUserModelConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserModelConfigEntity | null> {
    const raw = await this.prisma.userModelConfig.findUnique({ where: { id } });
    return raw ? UserModelConfigMapper.toDomain(raw) : null;
  }

  async findByUserId(userId: string): Promise<UserModelConfigEntity[]> {
    const rows = await this.prisma.userModelConfig.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => UserModelConfigMapper.toDomain(r));
  }

  async findDefaultForUser(
    userId: string,
  ): Promise<UserModelConfigEntity | null> {
    const defaultModel = await this.prisma.userModelConfig.findFirst({
      where: { userId, isDefault: true },
    });
    if (defaultModel) {
      return UserModelConfigMapper.toDomain(defaultModel);
    }

    // Fallback to first available model if none explicitly marked default
    const fallback = await this.prisma.userModelConfig.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return fallback ? UserModelConfigMapper.toDomain(fallback) : null;
  }

  async create(
    data: CreateUserModelConfigInput,
  ): Promise<UserModelConfigEntity> {
    const existingCount = await this.prisma.userModelConfig.count({
      where: { userId: data.userId },
    });

    // If first model or explicitly requested as default
    const isDefault = data.isDefault || existingCount === 0;

    if (isDefault) {
      await this.prisma.userModelConfig.updateMany({
        where: { userId: data.userId },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.userModelConfig.create({
      data: {
        userId: data.userId,
        label: data.label,
        provider: data.provider,
        modelName: data.modelName,
        apiKey: data.apiKey,
        baseUrl: data.baseUrl,
        isDefault,
      },
    });

    return UserModelConfigMapper.toDomain(created);
  }

  async update(
    id: string,
    data: UpdateUserModelConfigInput,
  ): Promise<UserModelConfigEntity> {
    const updated = await this.prisma.userModelConfig.update({
      where: { id },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.modelName !== undefined ? { modelName: data.modelName } : {}),
        ...(data.apiKey !== undefined ? { apiKey: data.apiKey } : {}),
        ...(data.baseUrl !== undefined ? { baseUrl: data.baseUrl } : {}),
      },
    });
    return UserModelConfigMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    const target = await this.prisma.userModelConfig.findUnique({
      where: { id },
    });
    if (!target) return;

    await this.prisma.userModelConfig.delete({ where: { id } });

    // If the deleted model was the default, set another one as default
    if (target.isDefault) {
      const remaining = await this.prisma.userModelConfig.findFirst({
        where: { userId: target.userId },
        orderBy: { createdAt: 'desc' },
      });
      if (remaining) {
        await this.prisma.userModelConfig.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        });
      }
    }
  }

  async setDefault(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userModelConfig.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      this.prisma.userModelConfig.update({
        where: { id, userId },
        data: { isDefault: true },
      }),
    ]);
  }
}
