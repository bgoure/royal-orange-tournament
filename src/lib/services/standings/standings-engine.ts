/**
 * Pure standings ordering: aggregate FINAL pool games and rank teams by points,
 * then tiebreakers (strict order). No I/O.
 */

const RATIO_EPS = 1e-9;

export type StandingsGameInput = {
  status: string;
  resultType: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeRuns: number | null;
  awayRuns: number | null;
  homeDefensiveInnings: number | null;
  awayDefensiveInnings: number | null;
  homeOffensiveInnings: number | null;
  awayOffensiveInnings: number | null;
};

/** Materialized aggregate used for PoolStanding rows and tiebreak “all games” stats. */
export type PoolTeamAggregate = {
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

type ScopedStat = {
  runsFor: number;
  runsAgainst: number;
  defensiveInnings: number;
  offensiveInnings: number;
  /** Wins in games where both teams are in the tied-on-points subgroup (head-to-head minileague). */
  winsAmong: number;
};

function isFinal(g: StandingsGameInput): boolean {
  return g.status === "FINAL";
}

export function emptyAggregate(teamId: string): PoolTeamAggregate {
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

export function applyGameToAggregates(
  aggs: Map<string, PoolTeamAggregate>,
  g: StandingsGameInput,
): void {
  if (!isFinal(g)) return;
  if (!g.homeTeamId || !g.awayTeamId) return;
  const home = aggs.get(g.homeTeamId);
  const away = aggs.get(g.awayTeamId);
  if (!home || !away) return;

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

/** Build per-team aggregates for all teamIds (including teams with no games). */
export function buildAggregates(
  teamIds: string[],
  games: StandingsGameInput[],
): Map<string, PoolTeamAggregate> {
  const aggs = new Map<string, PoolTeamAggregate>();
  for (const id of teamIds) {
    aggs.set(id, emptyAggregate(id));
  }
  for (const g of games) {
    applyGameToAggregates(aggs, g);
  }
  return aggs;
}

function raRatio(runsAgainst: number, defensiveInnings: number): number {
  if (defensiveInnings <= 0) return Number.POSITIVE_INFINITY;
  return runsAgainst / defensiveInnings;
}

function rfRatio(runsFor: number, offensiveInnings: number): number {
  if (offensiveInnings <= 0) return 0;
  return runsFor / offensiveInnings;
}

function scopedAmongTied(
  games: StandingsGameInput[],
  teamIds: Set<string>,
): Map<string, ScopedStat> {
  const m = new Map<string, ScopedStat>();
  for (const id of teamIds) {
    m.set(id, {
      runsFor: 0,
      runsAgainst: 0,
      defensiveInnings: 0,
      offensiveInnings: 0,
      winsAmong: 0,
    });
  }

  for (const g of games) {
    if (!isFinal(g)) continue;
    if (!g.homeTeamId || !g.awayTeamId) continue;
    if (!teamIds.has(g.homeTeamId) || !teamIds.has(g.awayTeamId)) continue;

    const h = m.get(g.homeTeamId)!;
    const a = m.get(g.awayTeamId)!;
    const hRuns = g.homeRuns ?? 0;
    const aRuns = g.awayRuns ?? 0;
    const hDI = g.homeDefensiveInnings ?? 0;
    const aDI = g.awayDefensiveInnings ?? 0;
    const hOI = g.homeOffensiveInnings ?? (hDI > 0 ? hDI : 0);
    const aOI = g.awayOffensiveInnings ?? (aDI > 0 ? aDI : 0);

    h.runsFor += hRuns;
    h.runsAgainst += aRuns;
    a.runsFor += aRuns;
    a.runsAgainst += hRuns;
    h.defensiveInnings += hDI;
    h.offensiveInnings += hOI;
    a.defensiveInnings += aDI;
    a.offensiveInnings += aOI;

    if (g.resultType === "FORFEIT_HOME_WINS") {
      h.winsAmong += 1;
    } else if (g.resultType === "FORFEIT_AWAY_WINS") {
      a.winsAmong += 1;
    } else if (hRuns > aRuns) {
      h.winsAmong += 1;
    } else if (aRuns > hRuns) {
      a.winsAmong += 1;
    }
  }
  return m;
}

function nearEqualNumbers(a: number, b: number): boolean {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (!Number.isFinite(a) && !Number.isFinite(b) && Math.sign(a) === Math.sign(b)) return true;
  return Math.abs(a - b) < RATIO_EPS;
}

/**
 * Tiebreak tuple: higher numeric prefix = better rank.
 * 1. head-to-head wins among tied teams
 * 2. RA ratio among tied teams (lower RA better → store negated)
 * 3. RA ratio all pool games
 * 4. RF ratio among tied teams
 * 5. RF ratio all pool games
 * 6. tiebreakOverrideRank (lower rank value = better → store as bonus)
 * 7. teamId lexicographic (coin-toss placeholder: stable arbitrary order)
 */
function tiebreakKey(
  teamId: string,
  aggs: Map<string, PoolTeamAggregate>,
  scoped: Map<string, ScopedStat>,
  tiebreakOverrideRank: number | null,
): readonly [number, number, number, number, number, number, string] {
  const agg = aggs.get(teamId)!;
  const sc = scoped.get(teamId)!;
  const h2h = sc.winsAmong;
  const raTied = -raRatio(sc.runsAgainst, sc.defensiveInnings);
  const raAll = -raRatio(agg.runsAgainst, agg.defensiveInnings);
  const rfTied = rfRatio(sc.runsFor, sc.offensiveInnings);
  const rfAll = rfRatio(agg.runsFor, agg.offensiveInnings);
  const manualBonus = tiebreakOverrideRank != null ? 10_000 - tiebreakOverrideRank : 0;
  return [h2h, raTied, raAll, rfTied, rfAll, manualBonus, teamId] as const;
}

function compareTiebreakKeys(
  a: readonly [number, number, number, number, number, number, string],
  b: readonly [number, number, number, number, number, number, string],
): number {
  for (let i = 0; i < 6; i++) {
    const av = a[i] as number;
    const bv = b[i] as number;
    if (!nearEqualNumbers(av, bv)) {
      return bv - av;
    }
  }
  return a[6].localeCompare(b[6]);
}

/** True if ordering between two teams required the teamId (step 6) tiebreak. */
function reliedOnCoinToss(
  a: readonly [number, number, number, number, number, number, string],
  b: readonly [number, number, number, number, number, number, string],
): boolean {
  for (let i = 0; i < 6; i++) {
    const av = a[i] as number;
    const bv = b[i] as number;
    if (!nearEqualNumbers(av, bv)) return false;
  }
  return a[6] !== b[6];
}

/**
 * Team IDs in display order (index 0 = first place). Same points are clustered;
 * tiebreakers applied within each cluster.
 */
export function orderTeamsForPool(
  teamIds: string[],
  games: StandingsGameInput[],
  aggs: Map<string, PoolTeamAggregate>,
  tiebreakOverrides: Map<string, number | null>,
): { order: string[]; usedCoinTossPlaceholder: boolean } {
  if (teamIds.length === 0) return { order: [], usedCoinTossPlaceholder: false };

  const byPoints = [...teamIds].sort((x, y) => {
    const px = aggs.get(x)?.points ?? 0;
    const py = aggs.get(y)?.points ?? 0;
    if (px !== py) return py - px;
    return x.localeCompare(y);
  });

  const result: string[] = [];
  let usedCoin = false;
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
    const scoped = scopedAmongTied(games, groupSet);
    const keys = group.map((tid) => ({
      tid,
      key: tiebreakKey(tid, aggs, scoped, tiebreakOverrides.get(tid) ?? null),
    }));
    keys.sort((a, b) => compareTiebreakKeys(a.key, b.key));

    for (let k = 0; k < keys.length - 1; k++) {
      if (reliedOnCoinToss(keys[k]!.key, keys[k + 1]!.key)) {
        usedCoin = true;
      }
    }
    for (const { tid } of keys) result.push(tid);
  }

  return { order: result, usedCoinTossPlaceholder: usedCoin };
}

const MANUAL_RANK_SENTINEL = 1_000_000;

/**
 * Manual standings mode: sort by director-assigned rank (lower = better).
 * Teams without a rank sort after ranked teams, then by name.
 */
export function orderTeamsManualStandings(
  teams: readonly { id: string; name: string }[],
  rankByTeamId: ReadonlyMap<string, number | null>,
): string[] {
  return [...teams]
    .sort((a, b) => {
      const ra = rankByTeamId.get(a.id) ?? null;
      const rb = rankByTeamId.get(b.id) ?? null;
      const sa = ra != null && ra > 0 ? ra : MANUAL_RANK_SENTINEL;
      const sb = rb != null && rb > 0 ? rb : MANUAL_RANK_SENTINEL;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    })
    .map((t) => t.id);
}
