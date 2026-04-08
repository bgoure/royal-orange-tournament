/**
 * Pure helpers for single-elimination bracket construction from pool standings.
 */

export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

export type PoolAdvancerInput = {
  /** Stable ordering key (e.g. division.sort + pool.sort). */
  poolSortKey: string;
  teamsAdvancing: number;
  standingsRows: { teamId: string; displayOrder: number }[];
};

/**
 * Take top K from each pool (by displayOrder), then interleave pools by finish depth:
 * all pool #1 seeds, then all pool #2 seeds, etc. Keeps pool leaders spread across the bracket (v1).
 */
export function collectAdvancingTeamIds(pools: PoolAdvancerInput[]): string[] {
  const rowsPerPool = pools.map((p) => {
    const sorted = [...p.standingsRows].sort((a, b) => a.displayOrder - b.displayOrder);
    return sorted.slice(0, Math.max(0, p.teamsAdvancing)).map((r) => r.teamId);
  });
  const maxDepth = rowsPerPool.reduce((m, r) => Math.max(m, r.length), 0);
  const out: string[] = [];
  for (let depth = 0; depth < maxDepth; depth++) {
    for (const row of rowsPerPool) {
      if (depth < row.length) out.push(row[depth]!);
    }
  }
  return out;
}

export function singleElimRoundName(roundIndex: number, totalRounds: number): string {
  const roundsFromFinal = totalRounds - 1 - roundIndex;
  if (roundsFromFinal <= 0) return "Final";
  if (roundsFromFinal === 1) return "Semifinals";
  if (roundsFromFinal === 2) return "Quarterfinals";
  return `Round ${roundIndex + 1}`;
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
