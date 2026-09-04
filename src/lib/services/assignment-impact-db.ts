import { prisma } from "@/lib/db";
import {
  formatPoolAssignmentImpactMessage,
  isCompetitiveSeatLocked,
  type AssignmentImpactSummary,
} from "@/lib/services/assignment-impact";

/**
 * Summarize games + published brackets that would be invalidated by moving the given teams
 * (any game that still lists them as home/away).
 */
export async function assessTeamPoolMoveImpact(
  tournamentId: string,
  teamIds: string[],
): Promise<AssignmentImpactSummary> {
  const unique = [...new Set(teamIds)];
  if (unique.length === 0) {
    return {
      lockedGames: 0,
      scheduledGames: 0,
      publishedBracket: false,
      publishedBracketDivisionIds: [],
    };
  }

  const games = await prisma.game.findMany({
    where: {
      tournamentId,
      OR: [{ homeTeamId: { in: unique } }, { awayTeamId: { in: unique } }],
    },
    select: {
      id: true,
      status: true,
      resultType: true,
      divisionId: true,
      poolId: true,
      bracketId: true,
    },
  });

  let lockedGames = 0;
  let scheduledGames = 0;
  const divisionIds = new Set<string>();

  for (const g of games) {
    if (isCompetitiveSeatLocked(g)) lockedGames += 1;
    else scheduledGames += 1;
    if (g.divisionId) divisionIds.add(g.divisionId);
  }

  const teams = await prisma.team.findMany({
    where: { id: { in: unique } },
    select: { pool: { select: { divisionId: true } } },
  });
  for (const t of teams) divisionIds.add(t.pool.divisionId);

  const published = await prisma.bracket.findMany({
    where: {
      tournamentId,
      divisionId: { in: [...divisionIds] },
      published: true,
    },
    select: { divisionId: true },
  });
  const publishedBracketDivisionIds = [...new Set(published.map((b) => b.divisionId))];

  return {
    lockedGames,
    scheduledGames,
    publishedBracket: publishedBracketDivisionIds.length > 0,
    publishedBracketDivisionIds,
  };
}

/** Hard-block when any locked game or any competition data would be invalidated. */
export function poolAssignmentBlockReason(impact: AssignmentImpactSummary): string | null {
  if (impact.lockedGames === 0 && impact.scheduledGames === 0 && !impact.publishedBracket) {
    return null;
  }
  return formatPoolAssignmentImpactMessage(impact);
}

/** Count later-round unplayed games that still have a team seated (seed save would clear them). */
export async function countClearableLaterRoundSeats(bracketId: string): Promise<number> {
  return prisma.game.count({
    where: {
      bracketId,
      status: { in: ["SCHEDULED", "POSTPONED", "CANCELLED"] },
      bracketRound: { roundIndex: { gt: 0 } },
      OR: [{ homeTeamId: { not: null } }, { awayTeamId: { not: null } }],
    },
  });
}
