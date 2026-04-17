-- CreateEnum
CREATE TYPE "BracketSetupMode" AS ENUM ('AUTOMATED', 'MANUAL');

-- AlterTable
ALTER TABLE "Bracket" ADD COLUMN "setupMode" "BracketSetupMode" NOT NULL DEFAULT 'AUTOMATED';
ALTER TABLE "Bracket" ADD COLUMN "consolationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bracket" ADD COLUMN "entryTeamCount" INTEGER NOT NULL DEFAULT 8;
