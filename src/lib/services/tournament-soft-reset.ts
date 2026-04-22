import { GameResultType, GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recomputeAllPoolsForTournament } from "@/lib/services/standings";
import {
  clearConsolationGameTeamSlots,
  clearLaterBracketRoundTeamSlots,
  resolveBracketTeamsFromStandingsAllowIncomplete,
} from "@/lib/services/bracket-resolution";

const SCORE_RESET = {
  homeRuns: null as number | null,
  awayRuns: null as number | null,
  homeDefensiveInnings: null as number | null,
  awayDefensiveInnings: null as number | null,
  homeOffensiveInnings: null as number | null,
  awayOffensiveInnings: null as number | null,
  resultType: GameResultType.REGULAR,
};

/**
 * Clears competitive state for a tournament: scores and all game statuses → scheduled,
 * recomputes pool standings, clears winner-advanced bracket slots and consolation teams,
 * then re-fills round 0 + consolation from current pool order (no RR-complete requirement).
 */
export async function softResetTournamentProgressForId(tournamentId: string): Promise<void> {
  await prisma.game.updateMany({
    where: { tournamentId },
    data: {
      status: GameStatus.SCHEDULED,
      ...SCORE_RESET,
    },
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
