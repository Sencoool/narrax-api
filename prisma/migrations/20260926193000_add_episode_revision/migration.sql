-- CreateTable
CREATE TABLE "EpisodeRevision" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "cast" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EpisodeRevision_episodeId_createdAt_idx" ON "EpisodeRevision"("episodeId", "createdAt");

-- AddForeignKey
ALTER TABLE "EpisodeRevision" ADD CONSTRAINT "EpisodeRevision_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

