import type { UserModelConfig as PrismaUserModelConfig } from '@prisma/client';
import {
  UserModelConfigEntity,
  type ModelProviderType,
} from '../../../domain/entities/user-model-config.entity.js';

export class UserModelConfigMapper {
  static toDomain(raw: PrismaUserModelConfig): UserModelConfigEntity {
    return new UserModelConfigEntity({
      id: raw.id,
      userId: raw.userId,
      label: raw.label,
      provider: raw.provider as ModelProviderType,
      modelName: raw.modelName,
      apiKey: raw.apiKey,
      baseUrl: raw.baseUrl,
      isDefault: raw.isDefault,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
