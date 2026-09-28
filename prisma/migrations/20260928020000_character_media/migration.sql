ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'character';

ALTER TABLE "MediaAsset" DROP CONSTRAINT "MediaAsset_characterId_fkey";
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MediaAsset_characterId_idx" ON "MediaAsset"("characterId");
