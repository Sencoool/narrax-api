import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AI_PROVIDER, type IAiProvider } from '../../ports/ai-provider.port.js';
import {
  NOVEL_REPOSITORY,
  type INovelRepository,
} from '../../../domain/repositories/novel.repository.interface.js';
import {
  EPISODE_REPOSITORY,
  type IEpisodeRepository,
} from '../../../domain/repositories/episode.repository.interface.js';
import {
  DomainForbiddenError,
  DomainNotFoundError,
  DomainValidationError,
} from '../../../domain/errors/domain-errors.js';
import { BuildRagContextUseCase } from '../rag/build-rag-context.use-case.js';

export const storylineSuggestionSchema = z.object({
  title: z.string().min(1).max(80),
  prompt: z.string().min(1).max(500),
});
export const storylineSuggestionsSchema = z
  .array(storylineSuggestionSchema)
  .min(1)
  .max(5);
export type StorylineSuggestion = z.infer<typeof storylineSuggestionSchema>;

export interface SuggestStorylinesInput {
  novelId: string;
  userId: string;
  episodeId?: string;
}

const SYSTEM_PROMPT = `คุณเป็นนักเขียนนิยายไทยที่กำลังช่วยวางโครงเรื่อง
เสนอ 3 แนวทาง "สิ่งที่ควรเกิดขึ้นต่อไป" ที่แตกต่างกันจริง ๆ (ไม่ใช่ประโยคเดียวกันเขียนใหม่)
ใช้เฉพาะตัวละครและฝ่ายที่ให้มาเท่านั้น ห้ามคิดชื่อใหม่ขึ้นมาเอง
ตอบเป็น JSON array เท่านั้น รูปแบบ: [{"title":"...","prompt":"..."}]`;

@Injectable()
export class SuggestStorylinesUseCase {
  constructor(
    @Inject(NOVEL_REPOSITORY) private readonly novels: INovelRepository,
    @Inject(EPISODE_REPOSITORY) private readonly episodes: IEpisodeRepository,
    @Inject(AI_PROVIDER) private readonly ai: IAiProvider,
    private readonly buildRagContext: BuildRagContextUseCase,
  ) {}

  async execute(input: SuggestStorylinesInput): Promise<StorylineSuggestion[]> {
    const novel = await this.novels.findById(input.novelId);
    if (!novel) throw new DomainNotFoundError('novel', input.novelId);
    if (!novel.isOwnedBy(input.userId)) throw new DomainForbiddenError();

    const currentEpisode = input.episodeId
      ? await this.episodes.findById(input.episodeId)
      : null;
    if (
      input.episodeId &&
      (!currentEpisode || currentEpisode.novelId !== input.novelId)
    ) {
      throw new DomainNotFoundError('episode', input.episodeId);
    }
    const episodeOrder =
      currentEpisode?.order ??
      (await this.episodes.findLastOrderByNovelId(input.novelId)) + 1;
    const priorEpisodes = (await this.episodes.findByNovelId(input.novelId))
      .filter(
        (episode) => episode.order <= episodeOrder && episode.episodeSummary,
      )
      .sort((a, b) => b.order - a.order)
      .slice(0, 2)
      .reverse();
    const tail = currentEpisode?.contentTail(1500) ?? '';
    const context = await this.buildRagContext.execute(
      input.novelId,
      tail || novel.summary || novel.title,
      5,
      currentEpisode?.cast,
      episodeOrder,
    );
    const userMessage = [
      `เรื่อง: ${novel.title}`,
      priorEpisodes.length
        ? `สรุปตอนก่อนหน้า:\n${priorEpisodes.map((episode) => `ตอน ${episode.order}: ${episode.episodeSummary}`).join('\n')}`
        : '',
      tail ? `ตอนปัจจุบัน (ส่วนท้าย):\n${tail}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.ai.generate(
        `${SYSTEM_PROMPT}\n\n${context.contextString}`,
        attempt === 0
          ? userMessage
          : `${userMessage}\n\nตอบเป็น JSON array เท่านั้น`,
        { temperature: 0.9, maxOutputTokens: 700 },
      );
      try {
        const json = raw
          .trim()
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, '');
        return storylineSuggestionsSchema.parse(JSON.parse(json)).slice(0, 3);
      } catch {
        // Small local models sometimes need one reminder to return valid JSON.
      }
    }
    throw new DomainValidationError('โมเดลตอบรูปแบบที่อ่านไม่ได้');
  }
}
