-- Broaden backfill: any tournament with brackets (or playoff games) and zero pool games
-- is bracket-only, even when presetKey was null.
UPDATE "Tournament" AS t
SET "hasPoolPlay" = false
WHERE "hasPoolPlay" = true
AND NOT EXISTS (
  SELECT 1 FROM "Game" g
  WHERE g."tournamentId" = t.id AND g."gameKind" = 'POOL'
)
AND (
  EXISTS (SELECT 1 FROM "Bracket" b WHERE b."tournamentId" = t.id)
  OR EXISTS (
    SELECT 1 FROM "Game" g
    WHERE g."tournamentId" = t.id
      AND g."gameKind" IN ('PLAYOFF', 'CONSOLATION')
  )
);
