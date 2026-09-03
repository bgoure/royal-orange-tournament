-- Game.homeTeamId / Game.awayTeamId: ON DELETE CASCADE -> ON DELETE SET NULL.
--
-- Deleting a team used to delete every game it appeared in, taking scores and
-- bracket history with it. Games now survive with an empty seat; `deleteTeam`
-- refuses to remove a team that is still referenced by any game.
--
-- SET NULL rather than RESTRICT so pool/division/tournament cascade deletes keep
-- working: RESTRICT is checked immediately and would abort those cascades even
-- though the referencing games are removed by the same statement.

ALTER TABLE "Game" DROP CONSTRAINT IF EXISTS "Game_homeTeamId_fkey";
ALTER TABLE "Game" ADD CONSTRAINT "Game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Game" DROP CONSTRAINT IF EXISTS "Game_awayTeamId_fkey";
ALTER TABLE "Game" ADD CONSTRAINT "Game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
