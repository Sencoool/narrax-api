import { Inject, Injectable } from '@nestjs/common';
import {
  CHARACTER_REPOSITORY,
  type ICharacterRepository,
  type CharacterRecord,
  type SaveCharacterData,
} from '../../../domain/repositories/character.repository.interface.js';
import { NOVEL_REPOSITORY, type INovelRepository } from '../../../domain/repositories/novel.repository.interface.js';
import { DomainForbiddenError, DomainConflictError } from '../../../domain/errors/domain-errors.js';

export interface SaveCharacterInput {
  novelId: string;
  userId: string;
  id?: string;
  name: string;
  role?: string | null;
  description?: string | null;
  introducedAtOrder?: number | null;
  sortOrder?: number;
  factionIds: string[];
}

@Injectable()
export class SaveCharacterUseCase {
  constructor(
    @Inject(CHARACTER_REPOSITORY) private readonly characters: ICharacterRepository,
    @Inject(NOVEL_REPOSITORY) private readonly novels: INovelRepository,
  ) {}

  async execute(input: SaveCharacterInput): Promise<CharacterRecord> {
    const { novelId, userId, id, name, ...rest } = input;

    const novel = await this.novels.findById(novelId);
    if (!novel || !novel.isOwnedBy(userId)) {
      throw new DomainForbiddenError('You do not own this novel');
    }

    // Duplicate-name check (case-insensitive, excluding self when updating).
    const existing = await this.characters.listForNovel(novelId);
    const duplicate = existing.find(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== id,
    );
    if (duplicate) {
      throw new DomainConflictError(`A character named "${name}" already exists in this novel`);
    }

    const data: SaveCharacterData = { novelId, id, name, ...rest };
    return this.characters.saveCharacter(data);
  }
}
