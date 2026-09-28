import { Inject, Injectable } from '@nestjs/common';
import {
  STORY_GENERATION_REPOSITORY,
  type IStoryGenerationRepository,
} from '../../../domain/repositories/story-generation.repository.interface.js';
import {
  NOVEL_REPOSITORY,
  type INovelRepository,
} from '../../../domain/repositories/novel.repository.interface.js';
import {
  EPISODE_REPOSITORY,
  type IEpisodeRepository,
} from '../../../domain/repositories/episode.repository.interface.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

@Injectable()
export class FindGenerationUseCase {
  constructor(
    @Inject(STORY_GENERATION_REPOSITORY)
    private readonly generations: IStoryGenerationRepository,
    @Inject(NOVEL_REPOSITORY) private readonly novels: INovelRepository,
    @Inject(EPISODE_REPOSITORY) private readonly episodes: IEpisodeRepository,
  ) {}

  async execute(id: string, userId: string) {
    const record = await this.generations.findById(id);
    if (!record?.novelId) throw new DomainNotFoundError('การสร้าง', id);
    const novel = await this.novels.findById(record.novelId);
    if (!novel?.isOwnedBy(userId))
      throw new DomainNotFoundError('การสร้าง', id);
    return record;
  }

  async listForEpisode(episodeId: string, userId: string) {
    const episode = await this.episodes.findById(episodeId);
    if (!episode) throw new DomainNotFoundError('ตอน', episodeId);
    const novel = await this.novels.findById(episode.novelId);
    if (!novel?.isOwnedBy(userId))
      throw new DomainNotFoundError('ตอน', episodeId);
    return this.generations.findByEpisodeId(episodeId);
  }
}
