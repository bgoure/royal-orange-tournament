-- CreateEnum
CREATE TYPE "GameKind" AS ENUM ('POOL', 'PLAYOFF', 'CONSOLATION');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "gameKind" "GameKind" NOT NULL DEFAULT 'POOL';
ALTER TABLE "Game" ADD COLUMN "divisionId" TEXT;
ALTER TABLE "Game" ADD COLUMN "consolationHomePoolId" TEXT;
ALTER TABLE "Game" ADD COLUMN "consolationHomeRank" INTEGER;
ALTER TABLE "Game" ADD COLUMN "consolationAwayPoolId" TEXT;
ALTER TABLE "Game" ADD COLUMN "consolationAwayRank" INTEGER;

UPDATE "Game" SET "gameKind" = 'PLAYOFF' WHERE "bracketId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Game" ADD CONSTRAINT "Game_consolationHomePoolId_fkey" FOREIGN KEY ("consolationHomePoolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Game" ADD CONSTRAINT "Game_consolationAwayPoolId_fkey" FOREIGN KEY ("consolationAwayPoolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Game_divisionId_idx" ON "Game"("divisionId");
