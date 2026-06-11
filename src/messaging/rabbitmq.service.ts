import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmqpConnectionManager,
  ChannelWrapper,
  connect,
} from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';

export type StoryGenerationEvent = {
  type: 'story-generation.created' | 'story-generation.updated';
  requestId: string;
  novelId?: string | null;
  status: string;
  provider: string;
  model?: string | null;
  outputLength?: number;
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private readonly connection: AmqpConnectionManager;
  private readonly channel: ChannelWrapper;
  private readonly queueName = 'story-generation-events';

  constructor(private readonly configService: ConfigService) {
    const url = this.getRabbitMqUrl();

    this.connection = connect([url]);
    this.channel = this.connection.createChannel({
      setup: async (channel: ConfirmChannel) => {
        await channel.assertQueue(this.queueName, { durable: true });
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }

  async publishStoryGenerationEvent(
    event: StoryGenerationEvent,
  ): Promise<void> {
    try {
      await this.channel.sendToQueue(
        this.queueName,
        Buffer.from(JSON.stringify(event)),
        {
          persistent: true,
          contentType: 'application/json',
        },
      );
    } catch (error) {
      this.logger.error('Failed to publish story generation event', error);
    }
  }

  private getRabbitMqUrl(): string {
    const explicitUrl = this.configService.get<string>('RABBITMQ_URL');
    if (explicitUrl) {
      return explicitUrl;
    }

    const username = this.configService.get<string>('RABBITMQ_DEFAULT_USER');
    const password = this.configService.get<string>('RABBITMQ_DEFAULT_PASS');
    const host = this.configService.get<string>('RABBITMQ_HOST') ?? 'localhost';
    const port = this.configService.get<string>('RABBITMQ_PORT') ?? '5672';

    if (!username || !password) {
      throw new Error(
        'RABBITMQ_DEFAULT_USER or RABBITMQ_DEFAULT_PASS is not set',
      );
    }

    return `amqp://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
  }
}
