import { Inject, Injectable } from '@nestjs/common';
import {
  CHARACTER_REPOSITORY,
  type ICharacterRepository,
  type CharacterBoard,
} from '../../../domain/repositories/character.repository.interface.js';
import {
  NOVEL_REPOSITORY,
  type INovelRepository,
} from '../../../domain/repositories/novel.repository.interface.js';
import { DomainForbiddenError } from '../../../domain/errors/domain-errors.js';

export interface ListCharacterBoardInput {
  novelId: string;
  userId: string;
}

@Injectable()
export class ListCharacterBoardUseCase {
  constructor(
    @Inject(CHARACTER_REPOSITORY)
    private readonly characters: ICharacterRepository,
    @Inject(NOVEL_REPOSITORY) private readonly novels: INovelRepository,
  ) {}

  async execute(input: ListCharacterBoardInput): Promise<CharacterBoard> {
    const { novelId, userId } = input;
    const novel = await this.novels.findById(novelId);
    if (!novel || !novel.isOwnedBy(userId)) {
      throw new DomainForbiddenError('You do not own this novel');
    }
    return this.characters.listBoard(novelId);
  }
}
