-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "characterId" TEXT;

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "description" TEXT,
    "introducedAtOrder" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faction" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "arcLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterFaction" (
    "characterId" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "rank" TEXT,

    CONSTRAINT "CharacterFaction_pkey" PRIMARY KEY ("characterId","factionId")
);

-- CreateIndex
CREATE INDEX "Character_novelId_sortOrder_idx" ON "Character"("novelId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Character_novelId_name_key" ON "Character"("novelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Faction_novelId_name_key" ON "Faction"("novelId", "name");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faction" ADD CONSTRAINT "Faction_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterFaction" ADD CONSTRAINT "CharacterFaction_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterFaction" ADD CONSTRAINT "CharacterFaction_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: promote the JSON blob in NovelContext.characters into rows.
-- Re-runnable: the unique index makes it a no-op on duplicates.
INSERT INTO "Character" ("id", "novelId", "name", "role", "description", "updatedAt")
SELECT gen_random_uuid(), nc."novelId", entry->>'name', entry->>'role', entry->>'description', NOW()
FROM "NovelContext" nc
CROSS JOIN LATERAL jsonb_array_elements(nc."characters"::jsonb) AS entry
WHERE nc."characters" IS NOT NULL
  AND jsonb_typeof(nc."characters"::jsonb) = 'array'
  AND COALESCE(entry->>'name', '') <> ''
ON CONFLICT ("novelId", "name") DO NOTHING;
