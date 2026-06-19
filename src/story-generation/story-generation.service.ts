import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../messaging/rabbitmq.service';
import { CreateStoryGenerationDto } from './dto/create-story-generation.dto';
import { FindStoryGenerationDto } from './dto/find-story-generation.dto';
import { UpdateStoryGenerationDto } from './dto/update-story-generation.dto';

@Injectable()
export class StoryGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMqService: RabbitMqService,
  ) {}

  async create(input: CreateStoryGenerationDto) {
    const request = await this.prisma.storyGenerationRequest.create({
      data: {
        novelId: input.novelId ?? null,
        prompt: input.prompt,
        status: 'pending',
        provider: input.provider,
        model: input.model ?? null,
        temperature: input.temperature ?? null,
        maxTokens: input.maxTokens ?? null,
      },
    });

    await this.rabbitMqService.publishStoryGenerationEvent({
      type: 'story-generation.created',
      requestId: request.id,
      novelId: request.novelId,
      status: request.status,
      provider: request.provider,
      model: request.model,
      createdAt: request.createdAt.toISOString(),
    });

    return request;
  }

  findAll(status?: FindStoryGenerationDto['status']) {
    return this.prisma.storyGenerationRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.storyGenerationRequest.findUnique({
      where: { id },
    });
  }

  async update(id: string, input: UpdateStoryGenerationDto) {
    const request = await this.prisma.storyGenerationRequest.update({
      where: { id },
      data: {
        status: input.status,
        output: input.output,
        error: input.error,
        externalJobId: input.externalJobId,
      },
    });

    await this.rabbitMqService.publishStoryGenerationEvent({
      type: 'story-generation.updated',
      requestId: request.id,
      novelId: request.novelId,
      status: request.status,
      provider: request.provider,
      model: request.model,
      outputLength: request.output ? request.output.length : undefined,
      error: request.error ?? undefined,
      updatedAt: request.updatedAt.toISOString(),
    });

    return request;
  }
}
