import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  USER_MODEL_CONFIG_REPOSITORY,
  type IUserModelConfigRepository,
} from '../domain/repositories/index.js';
import {
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
} from '../common/crypto.util.js';
import type { CreateUserModelDto } from './dto/create-user-model.dto.js';
import type { UpdateUserModelDto } from './dto/update-user-model.dto.js';
import type { TestUserModelDto } from './dto/test-user-model.dto.js';
import { getErrorMessage } from '../common/get-error-message.js';
import type { UserModelConfigEntity } from '../domain/entities/user-model-config.entity.js';
import { assertSafeBaseUrl } from './validate-base-url.js';
import { listOllamaModels } from './ollama-models.js';

export interface SafeUserModelConfig {
  id: string;
  userId: string;
  label: string;
  provider: string;
  modelName: string;
  maskedApiKey: string;
  baseUrl: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  message?: string;
  error?: string;
}

@Injectable()
export class UserModelsService {
  constructor(
    @Inject(USER_MODEL_CONFIG_REPOSITORY)
    private readonly repo: IUserModelConfigRepository,
  ) {}

  listLocalModels() {
    return listOllamaModels(
      process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    );
  }

  private toSafeDto(entity: UserModelConfigEntity): SafeUserModelConfig {
    const rawKey = entity.apiKey ? decryptApiKey(entity.apiKey) : '';
    return {
      id: entity.id,
      userId: entity.userId,
      label: entity.label,
      provider: entity.provider,
      modelName: entity.modelName,
      maskedApiKey: rawKey ? maskApiKey(rawKey) : '',
      baseUrl: entity.baseUrl,
      isDefault: entity.isDefault,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  async listForUser(userId: string): Promise<SafeUserModelConfig[]> {
    const list = await this.repo.findByUserId(userId);
    return list.map((item) => this.toSafeDto(item));
  }

  async getDefaultForUser(
    userId: string,
  ): Promise<UserModelConfigEntity | null> {
    return this.repo.findDefaultForUser(userId);
  }

  async getOne(userId: string, id: string): Promise<SafeUserModelConfig> {
    const found = await this.repo.findById(id);
    if (!found || found.userId !== userId) {
      throw new NotFoundException('Model configuration not found');
    }
    return this.toSafeDto(found);
  }

  async create(
    userId: string,
    dto: CreateUserModelDto,
  ): Promise<SafeUserModelConfig> {
    assertSafeBaseUrl(dto.baseUrl, dto.provider);
    const encryptedKey = dto.apiKey ? encryptApiKey(dto.apiKey.trim()) : null;
    const created = await this.repo.create({
      userId,
      label: dto.label.trim(),
      provider: dto.provider,
      modelName: dto.modelName.trim(),
      apiKey: encryptedKey,
      baseUrl: dto.baseUrl?.trim() || null,
      isDefault: dto.isDefault,
    });
    return this.toSafeDto(created);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateUserModelDto,
  ): Promise<SafeUserModelConfig> {
    const found = await this.repo.findById(id);
    if (!found || found.userId !== userId) {
      throw new NotFoundException('Model configuration not found');
    }

    assertSafeBaseUrl(dto.baseUrl, dto.provider ?? found.provider);
    const encryptedKey = dto.apiKey
      ? encryptApiKey(dto.apiKey.trim())
      : undefined;
    const updated = await this.repo.update(id, {
      label: dto.label?.trim(),
      modelName: dto.modelName?.trim(),
      apiKey: encryptedKey,
      baseUrl:
        dto.baseUrl !== undefined ? dto.baseUrl?.trim() || null : undefined,
    });

    if (dto.isDefault) {
      await this.repo.setDefault(userId, id);
    }

    const latest = (await this.repo.findById(id)) || updated;
    return this.toSafeDto(latest);
  }

  async delete(userId: string, id: string): Promise<void> {
    const found = await this.repo.findById(id);
    if (!found || found.userId !== userId) {
      throw new NotFoundException('Model configuration not found');
    }
    await this.repo.delete(id);
  }

  async setDefault(userId: string, id: string): Promise<void> {
    const found = await this.repo.findById(id);
    if (!found || found.userId !== userId) {
      throw new NotFoundException('Model configuration not found');
    }
    await this.repo.setDefault(userId, id);
  }

  async testConnection(
    userId: string,
    dto: TestUserModelDto,
  ): Promise<ConnectionTestResult> {
    let provider = dto.provider;
    let modelName = dto.modelName;
    let apiKey = dto.apiKey;
    let baseUrl = dto.baseUrl;

    // If ID provided, load from database
    if (dto.id) {
      const saved = await this.repo.findById(dto.id);
      if (!saved || saved.userId !== userId) {
        throw new NotFoundException('Saved model configuration not found');
      }
      provider = provider || saved.provider;
      modelName = modelName || saved.modelName;
      baseUrl = baseUrl !== undefined ? baseUrl : (saved.baseUrl ?? undefined);
      if (!apiKey && saved.apiKey) {
        apiKey = decryptApiKey(saved.apiKey);
      }
    }

    if (!provider || !modelName) {
      throw new BadRequestException(
        'Provider and model name are required for testing',
      );
    }
    assertSafeBaseUrl(baseUrl, provider);

    const start = Date.now();
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 10000);

    try {
      if (provider === 'ollama') {
        const url = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
        const res = await fetch(`${url}/api/tags`, {
          signal: abortController.signal,
        });
        if (!res.ok) {
          throw new Error(
            `Ollama returned status ${res.status}: ${res.statusText}`,
          );
        }
        const data = (await res.json()) as { models?: Array<{ name: string }> };
        const modelNames = data.models?.map((m) => m.name) ?? [];
        const found = modelNames.some(
          (n) => n === modelName || n.startsWith(`${modelName}:`),
        );
        const latencyMs = Date.now() - start;
        return {
          success: true,
          latencyMs,
          message: found
            ? `Connected to Ollama. Model "${modelName}" is ready.`
            : `Connected to Ollama (${modelNames.length} models installed). Note: "${modelName}" not found in local library.`,
        };
      }

      if (provider === 'openai' || provider === 'custom') {
        const rootUrl = baseUrl
          ? baseUrl.replace(/\/+$/, '')
          : 'https://api.openai.com/v1';
        const url = `${rootUrl}/chat/completions`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: 'Say hi in 1 word' }],
            max_tokens: 5,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Status ${res.status}: ${errText.slice(0, 200)}`);
        }
        return {
          success: true,
          latencyMs: Date.now() - start,
          message: `Connected successfully to ${provider} (${modelName}).`,
        };
      }

      if (provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: modelName,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Say hi' }],
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Status ${res.status}: ${errText.slice(0, 200)}`);
        }
        return {
          success: true,
          latencyMs: Date.now() - start,
          message: `Connected successfully to Anthropic (${modelName}).`,
        };
      }

      if (provider === 'google') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'hi' }] }],
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Status ${res.status}: ${errText.slice(0, 200)}`);
        }
        return {
          success: true,
          latencyMs: Date.now() - start,
          message: `Connected successfully to Google Gemini (${modelName}).`,
        };
      }

      if (provider === 'mistral') {
        const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Status ${res.status}: ${errText.slice(0, 200)}`);
        }
        return {
          success: true,
          latencyMs: Date.now() - start,
          message: `Connected successfully to Mistral (${modelName}).`,
        };
      }

      const unsupported: string = provider;
      throw new BadRequestException(`Unsupported provider: ${unsupported}`);
    } catch (err: unknown) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: getErrorMessage(err, 'Connection test failed'),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
