-- Reset legacy tournament-wide bracket rows (structure recreated via division wizard).
DELETE FROM "BracketMatch";
DELETE FROM "Game" WHERE "bracketId" IS NOT NULL;
DELETE FROM "BracketRound";
DELETE FROM "Bracket";

ALTER TABLE "Game" ADD COLUMN "schedulePlaceholder" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Bracket" DROP COLUMN "setupMode",
DROP COLUMN "consolationEnabled",
DROP COLUMN "entryTeamCount";

DROP TYPE "BracketSetupMode";

ALTER TABLE "Bracket" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bracket" ADD COLUMN "needsResolutionRefresh" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bracket" ADD COLUMN "divisionId" TEXT NOT NULL;

ALTER TABLE "Bracket" ADD CONSTRAINT "Bracket_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Bracket_divisionId_key" ON "Bracket"("divisionId");
