-- Rematch-aware losers pairing option for double-elim brackets

ALTER TABLE "Bracket" ADD COLUMN IF NOT EXISTS "avoidRematchesUntilForced" BOOLEAN NOT NULL DEFAULT false;
