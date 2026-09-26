import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IEpisodeRepository } from '../../../domain/repositories/episode.repository.interface.js';
import { EPISODE_REPOSITORY } from '../../../domain/repositories/episode.repository.interface.js';
import type { IAiProvider } from '../../ports/ai-provider.port.js';
import { AI_PROVIDER } from '../../ports/ai-provider.port.js';
import { EpisodeEntity } from '../../../domain/entities/episode.entity.js';
import { DomainValidationError } from '../../../domain/errors/domain-errors.js';
import { EnsureEpisodeOwnershipUseCase } from './ensure-episode-ownership.use-case.js';

/**
 * Generates (or re-generates) an AI episode summary and persists it.
 *
 * Called either:
 * - Automatically (fire-and-forget) after content upload/update
 * - Manually by the user via POST /episodes/:id/summary
 */
@Injectable()
export class GenerateEpisodeSummaryUseCase {
  private readonly logger = new Logger(GenerateEpisodeSummaryUseCase.name);

  constructor(
    @Inject(EPISODE_REPOSITORY)
    private readonly episodeRepo: IEpisodeRepository,
    @Inject(AI_PROVIDER)
    private readonly ai: IAiProvider,
    private readonly ensureEpisodeOwnership: EnsureEpisodeOwnershipUseCase,
  ) {}

  async execute(id: string, userId: string): Promise<EpisodeEntity> {
    const episode = await this.ensureEpisodeOwnership.execute(id, userId);
    if (!episode.hasContent()) {
      throw new DomainValidationError(
        `ตอนนี้ยังไม่มีเนื้อหา ไม่สามารถสร้าง summary ได้`,
      );
    }

    const summary = await this.callAiSummary(episode.title, episode.content);

    return this.episodeRepo.update(id, { episodeSummary: summary });
  }

  private async callAiSummary(
    episodeTitle: string,
    content: string,
  ): Promise<string> {
    const systemPrompt = `You are a skilled literary assistant who specializes in summarizing novel episodes.
Your task is to write a concise, engaging summary of the provided episode.

Rules:
- Detect the language of the episode content and respond in that same language.
- Length: 3–5 sentences.
- Capture the key plot events, character actions, and emotional tone.
- Do NOT include spoiler warnings or meta-commentary about the summary itself.
- Return ONLY the summary text, nothing else.`;

    const userMessage = `Episode title: "${episodeTitle}"\n\nEpisode content:\n${content}`;

    this.logger.debug(
      `Generating summary for episode "${episodeTitle}" (${content.length} chars)`,
    );

    return this.ai.generate(systemPrompt, userMessage, {
      temperature: 0.5,
      maxOutputTokens: 512,
    });
  }
}
