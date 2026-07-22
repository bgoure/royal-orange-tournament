/**
 * Rematch-aware pairing for double/triple losers rounds.
 * Prefer matchups that have never met; if rematches are unavoidable, minimize them
 * and randomly choose among equally good pairings ("forced redraw").
 */

export function meetingKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export type RematchPairingResult = {
  /** Ordered pairs (home, away) — side is arbitrary. */
  matchups: Array<[string, string]>;
  /** Odd-team leftover sitting out this wave (not assigned to a matchup). */
  byeTeamId: string | null;
  /** How many pairs in the chosen matching have already played. */
  rematchCount: number;
  /** True when rematchCount > 0 (at least one rematch was required). */
  forced: boolean;
};

function rematchCountForMatching(
  matchups: Array<[string, string]>,
  priorMeetings: ReadonlySet<string>,
): number {
  let n = 0;
  for (const [a, b] of matchups) {
    if (priorMeetings.has(meetingKey(a, b))) n += 1;
  }
  return n;
}

/** All perfect matchings for an even-sized list (exact; fine for ≤10 teams). */
function allPerfectMatchings(ids: string[]): Array<Array<[string, string]>> {
  if (ids.length === 0) return [[]];
  if (ids.length % 2 !== 0) {
    throw new Error("allPerfectMatchings requires an even number of teams");
  }
  const [first, ...rest] = ids;
  const out: Array<Array<[string, string]>> = [];
  for (let i = 0; i < rest.length; i++) {
    const partner = rest[i]!;
    const remaining = rest.filter((_, j) => j !== i);
    for (const sub of allPerfectMatchings(remaining)) {
      out.push([[first, partner], ...sub]);
    }
  }
  return out;
}

/**
 * Greedy multi-trial pairing for larger fields (exact enum becomes expensive past ~10).
 */
function greedyPairings(
  ids: string[],
  priorMeetings: ReadonlySet<string>,
  trials: number,
  rng: () => number,
): RematchPairingResult {
  let best: RematchPairingResult | null = null;

  for (let t = 0; t < trials; t++) {
    const pool = [...ids];
    // Fisher–Yates
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }

    const matchups: Array<[string, string]> = [];
    let byeTeamId: string | null = null;
    if (pool.length % 2 === 1) {
      byeTeamId = pool.pop() ?? null;
    }
    while (pool.length >= 2) {
      const a = pool.shift()!;
      let bestIdx = 0;
      let bestIsRematch = priorMeetings.has(meetingKey(a, pool[0]!));
      for (let i = 1; i < pool.length; i++) {
        const isRematch = priorMeetings.has(meetingKey(a, pool[i]!));
        if (bestIsRematch && !isRematch) {
          bestIdx = i;
          bestIsRematch = false;
        }
      }
      const b = pool.splice(bestIdx, 1)[0]!;
      matchups.push([a, b]);
    }

    const rematchCount = rematchCountForMatching(matchups, priorMeetings);
    const candidate: RematchPairingResult = {
      matchups,
      byeTeamId,
      rematchCount,
      forced: rematchCount > 0,
    };
    if (
      !best ||
      candidate.rematchCount < best.rematchCount ||
      (candidate.rematchCount === best.rematchCount && rng() < 0.5)
    ) {
      best = candidate;
    }
  }

  return best ?? { matchups: [], byeTeamId: null, rematchCount: 0, forced: false };
}

/**
 * Pair `teamIds` minimizing rematches vs `priorMeetings` (keys from {@link meetingKey}).
 * Among optimal pairings, picks randomly via `rng` (injectable for tests).
 */
export function pairTeamsAvoidingRematches(
  teamIds: string[],
  priorMeetings: ReadonlySet<string>,
  rng: () => number = Math.random,
): RematchPairingResult {
  const unique = [...new Set(teamIds.filter(Boolean))];
  if (unique.length === 0) {
    return { matchups: [], byeTeamId: null, rematchCount: 0, forced: false };
  }
  if (unique.length === 1) {
    return { matchups: [], byeTeamId: unique[0]!, rematchCount: 0, forced: false };
  }

  // Exact search is factorial; use greedy trials beyond 10 teams.
  if (unique.length > 10) {
    return greedyPairings(unique, priorMeetings, 48, rng);
  }

  type Candidate = { matchups: Array<[string, string]>; byeTeamId: string | null; rematchCount: number };
  const candidates: Candidate[] = [];

  if (unique.length % 2 === 0) {
    for (const matchups of allPerfectMatchings(unique)) {
      candidates.push({
        matchups,
        byeTeamId: null,
        rematchCount: rematchCountForMatching(matchups, priorMeetings),
      });
    }
  } else {
    for (let b = 0; b < unique.length; b++) {
      const byeTeamId = unique[b]!;
      const rest = unique.filter((_, i) => i !== b);
      for (const matchups of allPerfectMatchings(rest)) {
        candidates.push({
          matchups,
          byeTeamId,
          rematchCount: rematchCountForMatching(matchups, priorMeetings),
        });
      }
    }
  }

  let min = Infinity;
  for (const c of candidates) {
    if (c.rematchCount < min) min = c.rematchCount;
  }
  const best = candidates.filter((c) => c.rematchCount === min);
  const pick = best[Math.floor(rng() * best.length)] ?? best[0]!;
  return {
    matchups: pick.matchups,
    byeTeamId: pick.byeTeamId,
    rematchCount: pick.rematchCount,
    forced: pick.rematchCount > 0,
  };
}

/**
 * Place one arriving team into open seats, preferring non-rematch opponents.
 * Used when a losers round already has LIVE/FINAL games (can't full redraw).
 */
export function pickSeatAvoidingRematch(
  teamId: string,
  seats: Array<{
    gameId: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
  }>,
  priorMeetings: ReadonlySet<string>,
  rng: () => number = Math.random,
): { gameId: string; side: "home" | "away" } | null {
  const halfOpen: Array<{
    gameId: string;
    side: "home" | "away";
    opponentId: string;
    rematch: boolean;
  }> = [];
  const empty: Array<{ gameId: string }> = [];

  for (const g of seats) {
    const homeOpen = g.homeTeamId == null;
    const awayOpen = g.awayTeamId == null;
    if (homeOpen && awayOpen) {
      empty.push({ gameId: g.gameId });
    } else if (homeOpen && g.awayTeamId) {
      halfOpen.push({
        gameId: g.gameId,
        side: "home",
        opponentId: g.awayTeamId,
        rematch: priorMeetings.has(meetingKey(teamId, g.awayTeamId)),
      });
    } else if (awayOpen && g.homeTeamId) {
      halfOpen.push({
        gameId: g.gameId,
        side: "away",
        opponentId: g.homeTeamId,
        rematch: priorMeetings.has(meetingKey(teamId, g.homeTeamId)),
      });
    }
  }

  const preferred = halfOpen.filter((s) => !s.rematch);
  if (preferred.length > 0) {
    const pick = preferred[Math.floor(rng() * preferred.length)]!;
    return { gameId: pick.gameId, side: pick.side };
  }
  if (empty.length > 0) {
    const pick = empty[Math.floor(rng() * empty.length)]!;
    return { gameId: pick.gameId, side: "home" };
  }
  if (halfOpen.length > 0) {
    const pick = halfOpen[Math.floor(rng() * halfOpen.length)]!;
    return { gameId: pick.gameId, side: pick.side };
  }
  return null;
}
