/**
 * Pure helpers for single-elimination bracket construction from pool standings.
 */

export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
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

/** Valid playoff field sizes for this app (powers of 2, no byes). */
export function isValidEntryTeamCount(n: number): boolean {
  return n >= 2 && n <= 64 && isPowerOfTwo(n);
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
