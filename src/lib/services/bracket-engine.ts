/**
 * Pure helpers for single-elimination bracket construction from pool standings.
 */

export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

/** Smallest power of 2 ≥ n (n ≥ 1). */
export function nextPowerOfTwo(n: number): number {
  if (!Number.isInteger(n) || n < 1) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** How many bye slots are needed to fill a power-of-2 bracket for `teamCount` entrants. */
export function byeCountForField(teamCount: number): number {
  if (teamCount < 2) return 0;
  return nextPowerOfTwo(teamCount) - teamCount;
}

export type PoolAdvancerInput = {
  poolId: string;
  /** Stable ordering key (e.g. division.sort + pool.sort). */
  poolSortKey: string;
  teamsAdvancing: number;
  standingsRows: { teamId: string; displayOrder: number }[];
};

export type AdvancingSlotDescriptor = {
  poolId: string;
  /** 1 = first in pool (by display order). */
  rank: number;
  teamId: string;
};

/**
 * Take top K from each pool (by displayOrder), then interleave pools by finish depth:
 * all pool #1 seeds, then all pool #2 seeds, etc. Keeps pool leaders spread across the bracket (v1).
 */
/** Same interleave order as advancing team ids, with pool + finishing rank per slot. */
export function collectAdvancingSlotDescriptors(pools: PoolAdvancerInput[]): AdvancingSlotDescriptor[] {
  const rowsPerPool = pools.map((p) => {
    const sorted = [...p.standingsRows].sort((a, b) => a.displayOrder - b.displayOrder);
    return sorted.slice(0, Math.max(0, p.teamsAdvancing)).map((r, idx) => ({
      poolId: p.poolId,
      rank: idx + 1,
      teamId: r.teamId,
    }));
  });
  const maxDepth = rowsPerPool.reduce((m, r) => Math.max(m, r.length), 0);
  const out: AdvancingSlotDescriptor[] = [];
  for (let depth = 0; depth < maxDepth; depth++) {
    for (const row of rowsPerPool) {
      if (depth < row.length) out.push(row[depth]!);
    }
  }
  return out;
}

export function collectAdvancingTeamIds(pools: PoolAdvancerInput[]): string[] {
  return collectAdvancingSlotDescriptors(pools).map((s) => s.teamId);
}

export function singleElimRoundName(roundIndex: number, totalRounds: number): string {
  const roundsFromFinal = totalRounds - 1 - roundIndex;
  if (roundsFromFinal <= 0) return "Final";
  if (roundsFromFinal === 1) return "Semifinals";
  if (roundsFromFinal === 2) return "Quarterfinals";
  return `Round ${roundIndex + 1}`;
}

/** Labels for the consolation mini-bracket (first-round losers). */
export function consolationRoundName(roundIndex: number, totalRounds: number): string {
  const roundsFromFinal = totalRounds - 1 - roundIndex;
  if (roundsFromFinal <= 0) return "Consolation final";
  if (roundsFromFinal === 1) return "Consolation semifinals";
  if (roundsFromFinal === 2) return "Consolation quarterfinals";
  return `Consolation round ${roundIndex + 1}`;
}

/**
 * Valid playoff bracket size (power of 2, 2–64). First-round pairings length = n/2.
 * Non–power-of-2 advancing counts pad to this size with byes.
 */
export function isValidEntryTeamCount(n: number): boolean {
  return n >= 2 && n <= 64 && isPowerOfTwo(n);
}

/** Valid number of real advancing teams (byes fill up to next power of 2). */
export function isValidAdvancingTeamCount(n: number): boolean {
  return Number.isInteger(n) && n >= 2 && n <= 64;
}

export type SeededBracketSide =
  | { kind: "team"; poolId: string; rank: number }
  | { kind: "bye" };

/**
 * Place `slots` (interleaved advancing descriptors) into a power-of-2 field with byes.
 * Higher seeds (earlier in `slots`) receive byes first (classic single-elim seeding).
 */
export function padSlotsWithByes(
  slots: { poolId: string; rank: number }[],
): { bracketSize: number; firstRound: { home: SeededBracketSide; away: SeededBracketSide }[] } {
  const teamCount = slots.length;
  if (!isValidAdvancingTeamCount(teamCount)) {
    throw new Error("Advancing team count must be between 2 and 64.");
  }
  const bracketSize = nextPowerOfTwo(teamCount);
  const byeCount = bracketSize - teamCount;
  const field: SeededBracketSide[] = [
    ...slots.map((s) => ({ kind: "team" as const, poolId: s.poolId, rank: s.rank })),
    ...Array.from({ length: byeCount }, () => ({ kind: "bye" as const })),
  ];

  // Standard bracket seeding positions for 1..N then pair 1 vs N, 2 vs N-1, ...
  // For simplicity with byes appended: pair consecutive (0,1), (2,3), … after placing
  // real teams in seed order and byes at the end (weaker seeds play first round).
  // Better: give top seeds byes by pairing seed i with bye when i <= byeCount in classic order.
  const ordered = classicSingleElimOrder(bracketSize);
  const placed: SeededBracketSide[] = ordered.map((seedIndex) => {
    // seedIndex is 0-based seed; seeds 0..teamCount-1 are teams, rest byes conceptually
    if (seedIndex < teamCount) {
      const s = slots[seedIndex]!;
      return { kind: "team", poolId: s.poolId, rank: s.rank };
    }
    return { kind: "bye" };
  });

  const firstRound: { home: SeededBracketSide; away: SeededBracketSide }[] = [];
  for (let i = 0; i < bracketSize; i += 2) {
    firstRound.push({ home: placed[i]!, away: placed[i + 1]! });
  }
  return { bracketSize, firstRound };
}

/**
 * Classic single-elim seed positions (0-based): returns permutation of 0..size-1
 * such that adjacent pairs play in round 1 and higher seeds meet later.
 */
export function classicSingleElimOrder(size: number): number[] {
  if (!isPowerOfTwo(size) || size < 2) return Array.from({ length: size }, (_, i) => i);
  let seeds = [0, 1];
  while (seeds.length < size) {
    const n = seeds.length * 2;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(n - 1 - s);
    }
    seeds = next;
  }
  return seeds;
}

export function bracketLoserTeamId(input: {
  status: string;
  resultType: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeRuns: number | null;
  awayRuns: number | null;
}): string | null {
  if (input.status !== "FINAL") return null;
  if (input.resultType === "FORFEIT_HOME_WINS") return input.awayTeamId;
  if (input.resultType === "FORFEIT_AWAY_WINS") return input.homeTeamId;
  if (input.homeRuns == null || input.awayRuns == null) return null;
  if (input.homeRuns > input.awayRuns) return input.awayTeamId;
  if (input.awayRuns > input.homeRuns) return input.homeTeamId;
  return null;
}

/**
 * Game counts per losers (1-loss) round for a power-of-2 field of size `slots`.
 * Ends with a single losers-final game.
 */
export function doubleElimLosersRoundSizes(slots: number): number[] {
  if (!isPowerOfTwo(slots) || slots < 2) return [1];
  const winnerRounds = Math.log2(slots);
  const losersRoundCount = Math.max(1, 2 * winnerRounds - 1);
  const sizes: number[] = [];
  let games = slots / 2 - 1;
  for (let r = 0; r < losersRoundCount; r++) {
    sizes.push(Math.max(1, games));
    if (r % 2 === 1) games = Math.max(1, Math.floor(games / 2));
  }
  sizes[sizes.length - 1] = 1;
  return sizes;
}

/**
 * Game counts per L2 (2-loss) round for triple elimination.
 * Slightly shallower than L1; ends with one L2 final.
 */
export function tripleElimL2RoundSizes(slots: number): number[] {
  if (!isPowerOfTwo(slots) || slots < 2) return [1];
  const winnerRounds = Math.log2(slots);
  const roundCount = Math.max(1, 2 * winnerRounds - 2);
  const sizes: number[] = [];
  let games = Math.max(1, slots / 2 - 2);
  for (let r = 0; r < roundCount; r++) {
    sizes.push(Math.max(1, games));
    if (r % 2 === 1) games = Math.max(1, Math.floor(games / 2));
  }
  sizes[sizes.length - 1] = 1;
  return sizes;
}

export function bracketWinnerTeamId(input: {
  status: string;
  resultType: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeRuns: number | null;
  awayRuns: number | null;
}): string | null {
  if (input.status !== "FINAL") return null;
  if (input.resultType === "FORFEIT_HOME_WINS") return input.homeTeamId;
  if (input.resultType === "FORFEIT_AWAY_WINS") return input.awayTeamId;
  if (input.homeRuns == null || input.awayRuns == null) return null;
  if (input.homeRuns > input.awayRuns) return input.homeTeamId;
  if (input.awayRuns > input.homeRuns) return input.awayTeamId;
  return null;
}
