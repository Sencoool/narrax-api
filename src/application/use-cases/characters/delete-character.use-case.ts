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

export interface DeleteCharacterInput {
  novelId: string;
  userId: string;
  characterId: string;
}

@Injectable()
export class DeleteCharacterUseCase {
  constructor(
    @Inject(CHARACTER_REPOSITORY)
    private readonly characters: ICharacterRepository,
    @Inject(NOVEL_REPOSITORY) private readonly novels: INovelRepository,
  ) {}

  async execute(input: DeleteCharacterInput): Promise<void> {
    const { novelId, userId, characterId } = input;
    const novel = await this.novels.findById(novelId);
    if (!novel || !novel.isOwnedBy(userId)) {
      throw new DomainForbiddenError('You do not own this novel');
    }
    // Verify the character belongs to this novel before deleting.
    const all = await this.characters.listForNovel(novelId);
    if (!all.some((c) => c.id === characterId)) {
      throw new DomainForbiddenError('Character not found in this novel');
    }
    await this.characters.deleteCharacter(characterId);
  }
}
