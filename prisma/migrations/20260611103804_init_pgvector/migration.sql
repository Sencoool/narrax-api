-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "EpisodeChunk" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovelContext" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "characters" TEXT,
    "worldBuilding" TEXT,
    "plotOutline" TEXT,
    "writingStyle" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovelContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EpisodeChunk_novelId_idx" ON "EpisodeChunk"("novelId");

-- CreateIndex
CREATE INDEX "EpisodeChunk_episodeId_idx" ON "EpisodeChunk"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NovelContext_novelId_key" ON "NovelContext"("novelId");

-- AddForeignKey
ALTER TABLE "EpisodeChunk" ADD CONSTRAINT "EpisodeChunk_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeChunk" ADD CONSTRAINT "EpisodeChunk_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovelContext" ADD CONSTRAINT "NovelContext_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
