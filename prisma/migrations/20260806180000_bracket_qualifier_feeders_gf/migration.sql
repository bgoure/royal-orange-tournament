-- AlterEnum
CREATE TYPE "GrandFinalMode" AS ENUM ('SINGLE', 'IF_NECESSARY');

-- AlterEnum
CREATE TYPE "BracketSlotFeedKind" AS ENUM ('WINNER', 'LOSER');

-- AlterTable
ALTER TABLE "Bracket" ADD COLUMN "grandFinalMode" "GrandFinalMode" NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "Bracket" ADD COLUMN "isQualifier" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bracket" ADD COLUMN "qualifyingTeamCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Bracket" ADD COLUMN "concludedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BracketMatch" ADD COLUMN "homeFromMatchId" TEXT;
ALTER TABLE "BracketMatch" ADD COLUMN "awayFromMatchId" TEXT;
ALTER TABLE "BracketMatch" ADD COLUMN "homeFromKind" "BracketSlotFeedKind";
ALTER TABLE "BracketMatch" ADD COLUMN "awayFromKind" "BracketSlotFeedKind";
ALTER TABLE "BracketMatch" ADD COLUMN "loserDropMatchId" TEXT;

-- CreateIndex
CREATE INDEX "BracketMatch_homeFromMatchId_idx" ON "BracketMatch"("homeFromMatchId");
CREATE INDEX "BracketMatch_awayFromMatchId_idx" ON "BracketMatch"("awayFromMatchId");
CREATE INDEX "BracketMatch_loserDropMatchId_idx" ON "BracketMatch"("loserDropMatchId");

-- AddForeignKey
ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_homeFromMatchId_fkey" FOREIGN KEY ("homeFromMatchId") REFERENCES "BracketMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_awayFromMatchId_fkey" FOREIGN KEY ("awayFromMatchId") REFERENCES "BracketMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_loserDropMatchId_fkey" FOREIGN KEY ("loserDropMatchId") REFERENCES "BracketMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
