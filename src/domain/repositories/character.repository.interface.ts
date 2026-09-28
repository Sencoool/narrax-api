export interface CharacterRecord {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  /** null = known from the start; a number = introduced in that Episode.order. */
  introducedAtOrder: number | null;
  sortOrder: number;
  factionIds: string[];
  factionMemberships: { factionId: string; rank: string | null }[];
  imageUrl: string | null;
}

export interface FactionRecord {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  arcLabel: string | null;
  sortOrder: number;
}

export interface CharacterBoard {
  characters: CharacterRecord[];
  factions: FactionRecord[];
}

export interface SaveCharacterData {
  novelId: string;
  id?: string;
  name: string;
  role?: string | null;
  description?: string | null;
  introducedAtOrder?: number | null;
  sortOrder?: number;
  factionIds: string[];
}

export interface SaveFactionData {
  novelId: string;
  id?: string;
  name: string;
  description?: string | null;
  color?: string | null;
  arcLabel?: string | null;
  sortOrder?: number;
}

export interface ICharacterRepository {
  /** One read model for the whole board ? one round trip per render. */
  listBoard(novelId: string): Promise<CharacterBoard>;
  /** Everyone in the novel, unfiltered: used by the AI context builder. */
  listForNovel(novelId: string): Promise<CharacterRecord[]>;
  saveCharacter(data: SaveCharacterData): Promise<CharacterRecord>;
  deleteCharacter(id: string): Promise<void>;
  saveFaction(data: SaveFactionData): Promise<FactionRecord>;
  deleteFaction(id: string): Promise<void>;
}

export const CHARACTER_REPOSITORY = Symbol('ICharacterRepository');
