import { DomainForbiddenError } from '../../../domain/errors/domain-errors.js';
import { SaveCharacterUseCase } from './save-character.use-case.js';
import { SaveFactionUseCase } from './save-faction.use-case.js';
import { DeleteFactionUseCase } from './delete-faction.use-case.js';

describe('character board ownership', () => {
  const characters = {
    listBoard: jest.fn(),
    saveCharacter: jest.fn(),
    saveFaction: jest.fn(),
    deleteFaction: jest.fn(),
  };
  const novels = {
    findById: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    novels.findById.mockResolvedValue({
      isOwnedBy: (id: string) => id === 'owner',
    });
    characters.listBoard.mockResolvedValue({
      characters: [{ id: 'own-character', name: 'Ari' }],
      factions: [{ id: 'own-faction' }],
    });
  });

  it('does not update a character outside the requested novel', async () => {
    const useCase = new SaveCharacterUseCase(
      characters as never,
      novels as never,
    );
    await expect(
      useCase.execute({
        novelId: 'novel-1',
        userId: 'owner',
        id: 'foreign-character',
        name: 'Ari',
        factionIds: [],
      }),
    ).rejects.toBeInstanceOf(DomainForbiddenError);
    expect(characters.saveCharacter).not.toHaveBeenCalled();
  });

  it('does not attach a faction from another novel', async () => {
    const useCase = new SaveCharacterUseCase(
      characters as never,
      novels as never,
    );
    await expect(
      useCase.execute({
        novelId: 'novel-1',
        userId: 'owner',
        name: 'New character',
        factionIds: ['foreign-faction'],
      }),
    ).rejects.toBeInstanceOf(DomainForbiddenError);
    expect(characters.saveCharacter).not.toHaveBeenCalled();
  });

  it('does not update a faction outside the requested novel', async () => {
    const useCase = new SaveFactionUseCase(
      characters as never,
      novels as never,
    );
    await expect(
      useCase.execute({
        novelId: 'novel-1',
        userId: 'owner',
        id: 'foreign-faction',
        name: 'Outsiders',
      }),
    ).rejects.toBeInstanceOf(DomainForbiddenError);
    expect(characters.saveFaction).not.toHaveBeenCalled();
  });

  it('does not delete a faction outside the requested novel', async () => {
    const useCase = new DeleteFactionUseCase(
      characters as never,
      novels as never,
    );
    await expect(
      useCase.execute({
        novelId: 'novel-1',
        userId: 'owner',
        factionId: 'foreign-faction',
      }),
    ).rejects.toBeInstanceOf(DomainForbiddenError);
    expect(characters.deleteFaction).not.toHaveBeenCalled();
  });
});
