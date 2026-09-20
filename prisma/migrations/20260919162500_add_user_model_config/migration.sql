-- CreateEnum
CREATE TYPE "ModelProvider" AS ENUM ('openai', 'anthropic', 'google', 'mistral', 'ollama', 'custom');

-- CreateTable
CREATE TABLE "UserModelConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "provider" "ModelProvider" NOT NULL,
    "modelName" TEXT NOT NULL,
    "apiKey" TEXT,
    "baseUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserModelConfig_userId_idx" ON "UserModelConfig"("userId");

-- AddForeignKey
ALTER TABLE "UserModelConfig" ADD CONSTRAINT "UserModelConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
