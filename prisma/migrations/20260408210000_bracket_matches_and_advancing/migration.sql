-- CreateEnum
CREATE TYPE "BracketFormat" AS ENUM ('SINGLE_ELIMINATION');

-- AlterTable
ALTER TABLE "Pool" ADD COLUMN "teamsAdvancing" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Bracket" ADD COLUMN "format" "BracketFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION';

-- AlterTable
ALTER TABLE "Game" ALTER COLUMN "homeTeamId" DROP NOT NULL;
ALTER TABLE "Game" ALTER COLUMN "awayTeamId" DROP NOT NULL;

-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_bracketId_fkey";
ALTER TABLE "Game" DROP CONSTRAINT "Game_bracketRoundId_fkey";

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Game" ADD CONSTRAINT "Game_bracketRoundId_fkey" FOREIGN KEY ("bracketRoundId") REFERENCES "BracketRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BracketMatch" (
    "id" TEXT NOT NULL,
    "bracketRoundId" TEXT NOT NULL,
    "matchIndex" INTEGER NOT NULL,
    "gameId" TEXT,

    CONSTRAINT "BracketMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BracketMatch_gameId_key" ON "BracketMatch"("gameId");

-- CreateIndex
CREATE INDEX "BracketMatch_bracketRoundId_idx" ON "BracketMatch"("bracketRoundId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketMatch_bracketRoundId_matchIndex_key" ON "BracketMatch"("bracketRoundId", "matchIndex");

-- AddForeignKey
ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_bracketRoundId_fkey" FOREIGN KEY ("bracketRoundId") REFERENCES "BracketRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
