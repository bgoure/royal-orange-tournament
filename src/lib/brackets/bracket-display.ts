import type { BracketRoundType } from "@prisma/client";

/** e.g. rank 1 → "1st", 2 → "2nd" */
export function ordinalPlace(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}

/**
 * Placeholder when a slot is filled from pool standings but no team yet — e.g. "11U Royal 1st place".
 */
export function poolFinishPlaceholderLabel(
  divisionName: string,
  poolName: string,
  rank: number,
): string {
  return `${divisionName} ${poolName} ${ordinalPlace(rank)} place`;
}

export function hasConsolationRounds(
  rounds: { roundType: BracketRoundType }[],
): boolean {
  return rounds.some((r) => r.roundType === "LOSERS");
}

export type BracketScopeFilter = "all" | "main" | "consolation";

/** Main bracket: winners path + championship. Consolation: losers bracket rounds (if present). */
export function filterRoundsForScope<
  R extends { roundIndex: number; roundType: BracketRoundType },
>(rounds: R[], scope: BracketScopeFilter): R[] {
  const sorted = [...rounds].sort((a, b) => a.roundIndex - b.roundIndex);
  if (scope === "all") return sorted;
  if (scope === "main") {
    return sorted.filter((r) => r.roundType === "WINNERS" || r.roundType === "FINAL");
  }
  return sorted.filter((r) => r.roundType === "LOSERS");
}

export function roundTypeShortLabel(roundType: BracketRoundType): string {
  switch (roundType) {
    case "WINNERS":
      return "Winners";
    case "LOSERS":
      return "Consolation";
    case "FINAL":
      return "Final";
    default:
      return roundType;
  }
}
