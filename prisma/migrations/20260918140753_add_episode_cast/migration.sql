-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "cast" TEXT[] DEFAULT ARRAY[]::TEXT[];
