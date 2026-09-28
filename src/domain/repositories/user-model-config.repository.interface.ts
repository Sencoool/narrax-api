import type {
  UserModelConfigEntity,
  ModelProviderType,
} from '../entities/user-model-config.entity.js';

export interface CreateUserModelConfigInput {
  userId: string;
  label: string;
  provider: ModelProviderType;
  modelName: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  isDefault?: boolean;
  contextTokens?: number;
}

export interface UpdateUserModelConfigInput {
  label?: string;
  modelName?: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  contextTokens?: number;
}

export interface IUserModelConfigRepository {
  findById(id: string): Promise<UserModelConfigEntity | null>;
  findByUserId(userId: string): Promise<UserModelConfigEntity[]>;
  findDefaultForUser(userId: string): Promise<UserModelConfigEntity | null>;
  create(data: CreateUserModelConfigInput): Promise<UserModelConfigEntity>;
  update(
    id: string,
    data: UpdateUserModelConfigInput,
  ): Promise<UserModelConfigEntity>;
  delete(id: string): Promise<void>;
  setDefault(userId: string, id: string): Promise<void>;
}

export const USER_MODEL_CONFIG_REPOSITORY = Symbol(
  'USER_MODEL_CONFIG_REPOSITORY',
);
