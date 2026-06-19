-- AlterTable: remove mode column and drop GenerationMode enum
ALTER TABLE "StoryGenerationRequest" DROP COLUMN "mode";

-- DropEnum
DROP TYPE "GenerationMode";

-- AlterTable: add sourceEpisodeId (already in schema but missing from migrations due to drift)
ALTER TABLE "StoryGenerationRequest" ADD COLUMN "sourceEpisodeId" TEXT;

-- AlterTable: add googleId and make password nullable on User
ALTER TABLE "User" ADD COLUMN "googleId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "StoryGenerationRequest_sourceEpisodeId_idx" ON "StoryGenerationRequest"("sourceEpisodeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- AddForeignKey
ALTER TABLE "StoryGenerationRequest" ADD CONSTRAINT "StoryGenerationRequest_sourceEpisodeId_fkey" FOREIGN KEY ("sourceEpisodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
