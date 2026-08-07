-- Bracket-linked games were historically created as POOL (Prisma default).
-- Tag them PLAYOFF so Results / format detection treat them as playoffs.
UPDATE "Game"
SET "gameKind" = 'PLAYOFF'
WHERE "bracketId" IS NOT NULL AND "gameKind" = 'POOL';

-- Re-mark tournaments with no real pool games as bracket-only.
UPDATE "Tournament" AS t
SET "hasPoolPlay" = false
WHERE "hasPoolPlay" = true
AND NOT EXISTS (
  SELECT 1 FROM "Game" g
  WHERE g."tournamentId" = t.id
    AND g."gameKind" = 'POOL'
    AND g."bracketId" IS NULL
)
AND (
  EXISTS (SELECT 1 FROM "Bracket" b WHERE b."tournamentId" = t.id)
  OR EXISTS (
    SELECT 1 FROM "Game" g
    WHERE g."tournamentId" = t.id
      AND g."gameKind" IN ('PLAYOFF', 'CONSOLATION')
  )
);
