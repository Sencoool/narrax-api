import { Inject, Injectable } from '@nestjs/common';
import {
  CHARACTER_REPOSITORY,
  type ICharacterRepository,
} from '../../../domain/repositories/character.repository.interface.js';
import {
  NOVEL_REPOSITORY,
  type INovelRepository,
} from '../../../domain/repositories/novel.repository.interface.js';
import { DomainForbiddenError } from '../../../domain/errors/domain-errors.js';

export interface DeleteFactionInput {
  novelId: string;
  userId: string;
  factionId: string;
}

@Injectable()
export class DeleteFactionUseCase {
  constructor(
    @Inject(CHARACTER_REPOSITORY)
    private readonly characters: ICharacterRepository,
    @Inject(NOVEL_REPOSITORY) private readonly novels: INovelRepository,
  ) {}

  async execute(input: DeleteFactionInput): Promise<void> {
    const { novelId, userId, factionId } = input;
    const novel = await this.novels.findById(novelId);
    if (!novel || !novel.isOwnedBy(userId)) {
      throw new DomainForbiddenError('You do not own this novel');
    }
    const board = await this.characters.listBoard(novelId);
    if (!board.factions.some((faction) => faction.id === factionId)) {
      throw new DomainForbiddenError('Faction not found in this novel');
    }
    await this.characters.deleteFaction(factionId);
  }
}
