import { Inject, Injectable } from '@nestjs/common';
import {
  CHARACTER_REPOSITORY,
  type ICharacterRepository,
  type FactionRecord,
  type SaveFactionData,
} from '../../../domain/repositories/character.repository.interface.js';
import { NOVEL_REPOSITORY, type INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { DomainForbiddenError } from '../../../domain/errors/domain-errors.js';

export interface SaveFactionInput {
  novelId: string;
  userId: string;
  id?: string;
  name: string;
  description?: string | null;
  color?: string | null;
  arcLabel?: string | null;
  sortOrder?: number;
}

@Injectable()
export class SaveFactionUseCase {
  constructor(
    @Inject(CHARACTER_REPOSITORY) private readonly characters: ICharacterRepository,
    @Inject(NOVEL_REPOSITORY) private readonly novels: INovelRepository,
  ) {}

  async execute(input: SaveFactionInput): Promise<FactionRecord> {
    const { novelId, userId, ...data } = input;
    const novel = await this.novels.findById(novelId);
    if (!novel || !novel.isOwnedBy(userId)) {
      throw new DomainForbiddenError('You do not own this novel');
    }
    const factionData: SaveFactionData = { novelId, ...data };
    return this.characters.saveFaction(factionData);
  }
}
