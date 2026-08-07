-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "hasPoolPlay" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: OBA/preset brackets with no pool games are bracket-only.
UPDATE "Tournament" AS t
SET "hasPoolPlay" = false
WHERE NOT EXISTS (
  SELECT 1 FROM "Game" g
  WHERE g."tournamentId" = t.id AND g."gameKind" = 'POOL'
)
AND EXISTS (
  SELECT 1 FROM "Bracket" b
  WHERE b."tournamentId" = t.id AND b."presetKey" IS NOT NULL
);
