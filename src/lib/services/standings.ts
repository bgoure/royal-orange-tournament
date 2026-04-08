import { GameStatus, type Game } from "@prisma/client";
import { prisma } from "@/lib/db";

type TeamAgg = {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  points: number;
  runsFor: number;
  runsAgainst: number;
  defensiveInnings: number;
  offensiveInnings: number;
  forfeitLosses: number;
};

function emptyAgg(teamId: string): TeamAgg {
  return {
    teamId,
    wins: 0,
    losses: 0,
    ties: 0,
    points: 0,
    runsFor: 0,
    runsAgainst: 0,
    defensiveInnings: 0,
    offensiveInnings: 0,
    forfeitLosses: 0,
  };
}

function isCountableGame(g: Pick<Game, "status">): boolean {
  return g.status === GameStatus.FINAL;
}

function applyGameToAggs(
  aggs: Map<string, TeamAgg>,
  g: Pick<
    Game,
    | "homeTeamId"
    | "awayTeamId"
    | "homeRuns"
    | "awayRuns"
    | "homeDefensiveInnings"
    | "awayDefensiveInnings"
    | "homeOffensiveInnings"
    | "awayOffensiveInnings"
    | "resultType"
    | "status"
  >,
): void {
  if (!isCountableGame(g)) return;
  const home = aggs.get(g.homeTeamId)!;
  const away = aggs.get(g.awayTeamId)!;

  const hRuns = g.homeRuns ?? 0;
  const aRuns = g.awayRuns ?? 0;
  const hDI = g.homeDefensiveInnings ?? 0;
  const aDI = g.awayDefensiveInnings ?? 0;
  const hOI = g.homeOffensiveInnings ?? (hDI > 0 ? hDI : 0);
  const aOI = g.awayOffensiveInnings ?? (aDI > 0 ? aDI : 0);

  home.runsFor += hRuns;
  home.runsAgainst += aRuns;
  away.runsFor += aRuns;
  away.runsAgainst += hRuns;
  home.defensiveInnings += hDI;
  home.offensiveInnings += hOI;
  away.defensiveInnings += aDI;
  away.offensiveInnings += aOI;

  if (g.resultType === "FORFEIT_HOME_WINS") {
    away.forfeitLosses += 1;
    home.wins += 1;
    home.points += 2;
    away.losses += 1;
    return;
  }
  if (g.resultType === "FORFEIT_AWAY_WINS") {
    home.forfeitLosses += 1;
    away.wins += 1;
    away.points += 2;
    home.losses += 1;
    return;
  }

  if (hRuns > aRuns) {
    home.wins += 1;
    home.points += 2;
    away.losses += 1;
  } else if (aRuns > hRuns) {
    away.wins += 1;
    away.points += 2;
    home.losses += 1;
  } else {
    home.ties += 1;
    away.ties += 1;
    home.points += 1;
    away.points += 1;
  }
}

function raRatio(runsAgainst: number, defensiveInnings: number): number {
  if (defensiveInnings <= 0) return Number.POSITIVE_INFINITY;
  return runsAgainst / defensiveInnings;
}

function rfRatio(runsFor: number, offensiveInnings: number): number {
  if (offensiveInnings <= 0) return 0;
  return runsFor / offensiveInnings;
}

function scopeStatsForGroup(
  games: Game[],
  teamIds: Set<string>,
): Map<
  string,
  { runsFor: number; runsAgainst: number; defensiveInnings: number; offensiveInnings: number; wins: number; games: number }
> {
  const m = new Map<
    string,
    { runsFor: number; runsAgainst: number; defensiveInnings: number; offensiveInnings: number; wins: number; games: number }
  >();
  for (const id of teamIds) {
    m.set(id, { runsFor: 0, runsAgainst: 0, defensiveInnings: 0, offensiveInnings: 0, wins: 0, games: 0 });
  }
  for (const g of games) {
    if (!isCountableGame(g)) continue;
    if (!teamIds.has(g.homeTeamId) || !teamIds.has(g.awayTeamId)) continue;
    const h = m.get(g.homeTeamId)!;
    const a = m.get(g.awayTeamId)!;
    const hRuns = g.homeRuns ?? 0;
    const aRuns = g.awayRuns ?? 0;
    const hDI = g.homeDefensiveInnings ?? 0;
    const aDI = g.awayDefensiveInnings ?? 0;
    const hOI = g.homeOffensiveInnings ?? hDI;
    const aOI = g.awayOffensiveInnings ?? aDI;

    h.runsFor += hRuns;
    h.runsAgainst += aRuns;
    a.runsFor += aRuns;
    a.runsAgainst += hRuns;
    h.defensiveInnings += hDI;
    h.offensiveInnings += hOI;
    a.defensiveInnings += aDI;
    a.offensiveInnings += aOI;
    h.games += 1;
    a.games += 1;

    if (g.resultType === "REGULAR" || g.resultType === "FORFEIT_HOME_WINS" || g.resultType === "FORFEIT_AWAY_WINS") {
      if (g.resultType === "FORFEIT_HOME_WINS") {
        h.wins += 1;
      } else if (g.resultType === "FORFEIT_AWAY_WINS") {
        a.wins += 1;
      } else if (hRuns > aRuns) h.wins += 1;
      else if (aRuns > hRuns) a.wins += 1;
    }
  }
  return m;
}

/** Lexicographic tuple for sorting (higher = better rank = earlier in sorted array). */
function tiebreakKey(
  teamId: string,
  groupIds: Set<string>,
  aggs: Map<string, TeamAgg>,
  scoped: ReturnType<typeof scopeStatsForGroup>,
  overrideRank: number | null,
): readonly [number, number, number, number, number, number, number, string] {
  const agg = aggs.get(teamId)!;
  const sc = scoped.get(teamId)!;
  const forfeited = agg.forfeitLosses > 0 ? 0 : 1;
  const h2hWins = sc.wins;
  const raTied = -raRatio(sc.runsAgainst, sc.defensiveInnings);
  const raAll = -raRatio(agg.runsAgainst, agg.defensiveInnings);
  const rfTied = rfRatio(sc.runsFor, sc.offensiveInnings);
  const rfAll = rfRatio(agg.runsFor, agg.offensiveInnings);
  const manual = overrideRank != null ? -overrideRank : 0;
  return [forfeited, h2hWins, raTied, raAll, rfTied, rfAll, manual, teamId] as const;
}

function compareKeys(
  a: readonly [number, number, number, number, number, number, number, string],
  b: readonly [number, number, number, number, number, number, number, string],
): number {
  for (let i = 0; i < 7; i++) {
    const av = a[i] as number;
    const bv = b[i] as number;
    if (av !== bv) return bv - av;
  }
  return a[7].localeCompare(b[7]);
}

/** Returns team ids in display order (first = highest rank). */
export function orderTeamsForPool(
  teamIds: string[],
  games: Game[],
  aggs: Map<string, TeamAgg>,
  tiebreakOverrides: Map<string, number | null>,
): { order: string[]; needsManualTiebreak: boolean } {
  if (teamIds.length === 0) return { order: [], needsManualTiebreak: false };

  const byPoints = [...teamIds].sort((x, y) => {
    const px = aggs.get(x)?.points ?? 0;
    const py = aggs.get(y)?.points ?? 0;
    if (px !== py) return py - px;
    return x.localeCompare(y);
  });

  const result: string[] = [];
  let needsManual = false;
  let i = 0;
  while (i < byPoints.length) {
    const p = aggs.get(byPoints[i]!)?.points ?? 0;
    const group: string[] = [];
    while (i < byPoints.length && (aggs.get(byPoints[i]!)?.points ?? 0) === p) {
      group.push(byPoints[i]!);
      i++;
    }
    if (group.length === 1) {
      result.push(group[0]!);
      continue;
    }
    const groupSet = new Set(group);
    const scoped = scopeStatsForGroup(games, groupSet);
    const keys = group.map((tid) => ({
      tid,
      key: tiebreakKey(tid, groupSet, aggs, scoped, tiebreakOverrides.get(tid) ?? null),
    }));
    keys.sort((a, b) => compareKeys(a.key, b.key));

    for (let k = 0; k < keys.length - 1; k++) {
      if (compareKeys(keys[k]!.key, keys[k + 1]!.key) === 0) {
        needsManual = true;
        break;
      }
    }
    for (const { tid } of keys) result.push(tid);
  }

  return { order: result, needsManualTiebreak: needsManual };
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

  const aggs = new Map<string, TeamAgg>();
  for (const t of pool.teams) aggs.set(t.id, emptyAgg(t.id));

  for (const g of pool.games) {
    applyGameToAggs(aggs, g);
  }

  const tiebreakOverrides = new Map<string, number | null>();
  for (const row of pool.standings) {
    tiebreakOverrides.set(row.teamId, row.tiebreakOverrideRank ?? null);
  }

  const { order, needsManualTiebreak } = orderTeamsForPool(
    pool.teams.map((t) => t.id),
    pool.games,
    aggs,
    tiebreakOverrides,
  );

  if (needsManualTiebreak && process.env.NODE_ENV === "development") {
    console.warn(`[standings] Pool ${poolId} has unresolved tiebreakers after rule (vi); using stable fallback.`);
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
