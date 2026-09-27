import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  ICharacterRepository,
  CharacterRecord,
  CharacterBoard,
  FactionRecord,
  SaveCharacterData,
  SaveFactionData,
} from '../../../domain/repositories/character.repository.interface.js';

function toCharacterRecord(row: {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  introducedAtOrder: number | null;
  sortOrder: number;
  factions: { factionId: string; rank: string | null }[];
  media: { url: string }[];
}): CharacterRecord {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    description: row.description,
    introducedAtOrder: row.introducedAtOrder,
    sortOrder: row.sortOrder,
    factionIds: row.factions.map((f) => f.factionId),
    imageUrl: row.media[0]?.url ?? null,
  };
}

function toFactionRecord(row: {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  arcLabel: string | null;
  sortOrder: number;
}): FactionRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    arcLabel: row.arcLabel,
    sortOrder: row.sortOrder,
  };
}

@Injectable()
export class PrismaCharacterRepository implements ICharacterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listBoard(novelId: string): Promise<CharacterBoard> {
    const [characters, factions] = await Promise.all([
      this.prisma.character.findMany({
        where: { novelId },
        orderBy: { sortOrder: 'asc' },
        include: {
          factions: { select: { factionId: true, rank: true } },
          media: { select: { url: true }, take: 1 },
        },
      }),
      this.prisma.faction.findMany({
        where: { novelId },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    return {
      characters: characters.map(toCharacterRecord),
      factions: factions.map(toFactionRecord),
    };
  }

  async listForNovel(novelId: string): Promise<CharacterRecord[]> {
    const rows = await this.prisma.character.findMany({
      where: { novelId },
      orderBy: { sortOrder: 'asc' },
      include: {
        factions: { select: { factionId: true, rank: true } },
        media: { select: { url: true }, take: 1 },
      },
    });
    return rows.map(toCharacterRecord);
  }

  async saveCharacter(data: SaveCharacterData): Promise<CharacterRecord> {
    const { novelId, id, name, role, description, introducedAtOrder, sortOrder, factionIds } = data;

    const row = await this.prisma.$transaction(async (tx) => {
      const char = await tx.character.upsert({
        where: id ? { id } : { novelId_name: { novelId, name } },
        create: {
          novelId,
          name,
          role: role ?? null,
          description: description ?? null,
          introducedAtOrder: introducedAtOrder ?? null,
          sortOrder: sortOrder ?? 0,
        },
        update: {
          name,
          role: role ?? null,
          description: description ?? null,
          introducedAtOrder: introducedAtOrder ?? null,
          sortOrder: sortOrder ?? 0,
        },
      });

      // Replace all faction memberships atomically.
      await tx.characterFaction.deleteMany({ where: { characterId: char.id } });
      if (factionIds.length > 0) {
        await tx.characterFaction.createMany({
          data: factionIds.map((factionId) => ({ characterId: char.id, factionId })),
        });
      }

      return tx.character.findUniqueOrThrow({
        where: { id: char.id },
        include: {
          factions: { select: { factionId: true, rank: true } },
          media: { select: { url: true }, take: 1 },
        },
      });
    });

    return toCharacterRecord(row);
  }

  async deleteCharacter(id: string): Promise<void> {
    await this.prisma.character.delete({ where: { id } });
  }

  async saveFaction(data: SaveFactionData): Promise<FactionRecord> {
    const { novelId, id, name, description, color, arcLabel, sortOrder } = data;
    const row = await this.prisma.faction.upsert({
      where: id ? { id } : { novelId_name: { novelId, name } },
      create: { novelId, name, description: description ?? null, color: color ?? null, arcLabel: arcLabel ?? null, sortOrder: sortOrder ?? 0 },
      update: { name, description: description ?? null, color: color ?? null, arcLabel: arcLabel ?? null, sortOrder: sortOrder ?? 0 },
    });
    return toFactionRecord(row);
  }

  async deleteFaction(id: string): Promise<void> {
    await this.prisma.faction.delete({ where: { id } });
  }
}
