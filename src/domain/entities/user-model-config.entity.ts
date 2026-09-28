export type ModelProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'ollama'
  | 'custom';

export interface UserModelConfigProps {
  id: string;
  userId: string;
  label: string;
  provider: ModelProviderType;
  modelName: string;
  apiKey: string | null;
  baseUrl: string | null;
  isDefault: boolean;
  contextTokens?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class UserModelConfigEntity {
  readonly id: string;
  readonly userId: string;
  readonly label: string;
  readonly provider: ModelProviderType;
  readonly modelName: string;
  readonly apiKey: string | null;
  readonly baseUrl: string | null;
  readonly isDefault: boolean;
  readonly contextTokens: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: UserModelConfigProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.label = props.label;
    this.provider = props.provider;
    this.modelName = props.modelName;
    this.apiKey = props.apiKey ?? null;
    this.baseUrl = props.baseUrl ?? null;
    this.isDefault = props.isDefault ?? false;
    this.contextTokens = props.contextTokens ?? 8192;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
