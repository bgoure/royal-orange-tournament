import { prisma } from "@/lib/db";
import type { Game } from "@prisma/client";
import { markBracketsStaleForDivision } from "@/lib/services/bracket-resolution";
import {
  buildAggregates,
  orderTeamsForPool,
  orderTeamsManualStandings,
  type StandingsGameInput,
} from "./standings-engine";

function gameToInput(g: Game): StandingsGameInput {
  return {
    status: g.status,
    resultType: g.resultType,
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    homeRuns: g.homeRuns,
    awayRuns: g.awayRuns,
    homeDefensiveInnings: g.homeDefensiveInnings,
    awayDefensiveInnings: g.awayDefensiveInnings,
    homeOffensiveInnings: g.homeOffensiveInnings,
    awayOffensiveInnings: g.awayOffensiveInnings,
  };
}

export async function recomputePoolStandings(poolId: string): Promise<void> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      teams: true,
      games: true,
      standings: true,
    },
  });
  if (!pool) return;

  const gamesInput = pool.games.map(gameToInput);
  const aggs = buildAggregates(
    pool.teams.map((t) => t.id),
    gamesInput,
  );

  const tiebreakOverrides = new Map<string, number | null>();
  const manualRanks = new Map<string, number | null>();
  for (const row of pool.standings) {
    tiebreakOverrides.set(row.teamId, row.tiebreakOverrideRank ?? null);
    manualRanks.set(row.teamId, row.tiebreakOverrideRank ?? null);
  }

  let order: string[];
  if (pool.standingsManualMode) {
    order = orderTeamsManualStandings(pool.teams, manualRanks);
  } else {
    const { order: autoOrder, usedCoinTossPlaceholder } = orderTeamsForPool(
      pool.teams.map((t) => t.id),
      gamesInput,
      aggs,
      tiebreakOverrides,
    );
    order = autoOrder;
    if (usedCoinTossPlaceholder && process.env.NODE_ENV === "development") {
      console.warn(
        `[standings] Pool ${poolId}: placeholder coin-toss (teamId ordering) used after tiebreakers 1–5.`,
      );
    }
  }

  const now = new Date();
  for (let i = 0; i < order.length; i++) {
    const teamId = order[i]!;
    const a = aggs.get(teamId)!;
    await prisma.poolStanding.upsert({
      where: { poolId_teamId: { poolId, teamId } },
      create: {
        poolId,
        teamId,
        wins: a.wins,
        losses: a.losses,
        ties: a.ties,
        points: a.points,
        runsFor: a.runsFor,
        runsAgainst: a.runsAgainst,
        defensiveInnings: a.defensiveInnings,
        offensiveInnings: a.offensiveInnings,
        forfeitLosses: a.forfeitLosses,
        displayOrder: i,
        lastComputedAt: now,
      },
      update: {
        wins: a.wins,
        losses: a.losses,
        ties: a.ties,
        points: a.points,
        runsFor: a.runsFor,
        runsAgainst: a.runsAgainst,
        defensiveInnings: a.defensiveInnings,
        offensiveInnings: a.offensiveInnings,
        forfeitLosses: a.forfeitLosses,
        displayOrder: i,
        lastComputedAt: now,
      },
    });
  }

  await markBracketsStaleForDivision(pool.divisionId);
}

export async function recomputeAllPoolsForTournament(tournamentId: string): Promise<void> {
  const pools = await prisma.pool.findMany({
    where: { division: { tournamentId } },
    select: { id: true },
  });
  for (const p of pools) {
    await recomputePoolStandings(p.id);
  }
}
