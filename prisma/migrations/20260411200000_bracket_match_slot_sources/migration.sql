-- BracketMatch: optional pool + standing-rank labels for TBD slots (round 0 shell / placeholders).
ALTER TABLE "BracketMatch" ADD COLUMN "homeSourcePoolId" TEXT;
ALTER TABLE "BracketMatch" ADD COLUMN "homeSourceRank" INTEGER;
ALTER TABLE "BracketMatch" ADD COLUMN "awaySourcePoolId" TEXT;
ALTER TABLE "BracketMatch" ADD COLUMN "awaySourceRank" INTEGER;

ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_homeSourcePoolId_fkey" FOREIGN KEY ("homeSourcePoolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_awaySourcePoolId_fkey" FOREIGN KEY ("awaySourcePoolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
