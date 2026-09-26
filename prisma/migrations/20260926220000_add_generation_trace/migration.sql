-- AlterTable
ALTER TABLE "StoryGenerationRequest" ADD COLUMN     "contextSnapshot" JSONB,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "systemPrompt" TEXT;

