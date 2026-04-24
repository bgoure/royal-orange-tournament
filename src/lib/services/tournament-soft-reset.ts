import { GameKind, GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { gameCompetitiveResetData } from "@/lib/services/game-competitive-reset";
import { recomputeAllPoolsForTournament } from "@/lib/services/standings";
import {
  clearConsolationGameTeamSlots,
  clearLaterBracketRoundTeamSlots,
  resolveBracketTeamsFromStandingsAllowIncomplete,
} from "@/lib/services/bracket-resolution";

/** Score-only reset for all games (keeps pool and seeded playoff slot assignments until later steps). */
const SCORE_RESET_FOR_ALL_GAMES = {
  status: GameStatus.SCHEDULED,
  homeRuns: null as number | null,
  awayRuns: null as number | null,
  homeDefensiveInnings: null as number | null,
  awayDefensiveInnings: null as number | null,
  homeOffensiveInnings: null as number | null,
  awayOffensiveInnings: null as number | null,
  resultType: gameCompetitiveResetData.resultType,
};

/**
 * Clears competitive state for a tournament: scores and all game statuses → scheduled,
 * recomputes pool standings, clears winner-advanced bracket slots and consolation teams,
 * then re-fills round 0 + consolation from current pool order (no RR-complete requirement).
 */
export async function softResetTournamentProgressForId(tournamentId: string): Promise<void> {
  await prisma.game.updateMany({
    where: { tournamentId },
    data: SCORE_RESET_FOR_ALL_GAMES,
  });

  await prisma.game.updateMany({
    where: { tournamentId, gameKind: GameKind.CONSOLATION },
    data: { ...gameCompetitiveResetData },
  });

  await clearLaterBracketRoundTeamSlots(tournamentId);
  await clearConsolationGameTeamSlots(tournamentId);

  await recomputeAllPoolsForTournament(tournamentId);

  const brackets = await prisma.bracket.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  for (const b of brackets) {
    await resolveBracketTeamsFromStandingsAllowIncomplete(b.id);
  }
}
