import { Injectable, Inject } from '@nestjs/common';
import type { INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import type { UpsertNovelContextData } from '../../../domain/repositories/novel.repository.interface.js';
import { NOVEL_REPOSITORY } from '../../../domain/repositories/novel.repository.interface.js';
import type { NovelContextProps } from '../../../domain/entities/novel.entity.js';
import { DomainNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface UpsertNovelContextInput {
  /**
   * JSON-serialised characters array — stored as string in DB.
   * The application layer receives it as a string already serialised by the controller.
   */
  characters?: string | null;
  worldBuilding?: string | null;
  plotOutline?: string | null;
  writingStyle?: string | null;
}

@Injectable()
export class UpsertNovelContextUseCase {
  constructor(
    @Inject(NOVEL_REPOSITORY)
    private readonly novelRepo: INovelRepository,
  ) {}

  async execute(
    novelId: string,
    input: UpsertNovelContextInput,
  ): Promise<NovelContextProps> {
    // Ensure the novel exists
    const novel = await this.novelRepo.findById(novelId);
    if (!novel) {
      throw new DomainNotFoundError('นิยาย', novelId);
    }

    const data: UpsertNovelContextData = {
      characters: input.characters,
      worldBuilding: input.worldBuilding,
      plotOutline: input.plotOutline,
      writingStyle: input.writingStyle,
    };

    return this.novelRepo.upsertContext(novelId, data);
  }
}
