import type { BracketRoundType, GameKind } from "@prisma/client";

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
  return rounds.some((r) => r.roundType === "LOSERS" || r.roundType === "LOSERS_SECOND");
}

export type BracketScopeFilter = "all" | "main" | "consolation";

/** Main bracket: winners path + championship. Consolation: losers / L2 rounds (if present). */
export function filterRoundsForScope<
  R extends { roundIndex: number; roundType: BracketRoundType },
>(rounds: R[], scope: BracketScopeFilter): R[] {
  const sorted = [...rounds].sort((a, b) => a.roundIndex - b.roundIndex);
  if (scope === "all") return sorted;
  if (scope === "main") {
    return sorted.filter((r) => r.roundType === "WINNERS" || r.roundType === "FINAL");
  }
  return sorted.filter((r) => r.roundType === "LOSERS" || r.roundType === "LOSERS_SECOND");
}

export function roundTypeShortLabel(roundType: BracketRoundType): string {
  switch (roundType) {
    case "WINNERS":
      return "Winners";
    case "LOSERS":
      return "Losers (1 loss)";
    case "LOSERS_SECOND":
      return "Losers (2 losses)";
    case "FINAL":
      return "Final";
    default:
      return roundType;
  }
}

export type BidirectionalDeLayout<R extends { roundIndex: number; roundType: BracketRoundType }> = {
  /** Losers columns, already ordered left→right (later losers on the far left). */
  left: R[];
  /** Round 1 / first winners column (center). */
  center: R | null;
  /** Later winners + grand final, left→right. */
  right: R[];
};

/**
 * Losers ← center (W0) → winners → grand final.
 * Supports legacy DE (FINAL before losers) and new DE (FINAL after losers).
 */
export function bidirectionalDeLayout<
  R extends { roundIndex: number; roundType: BracketRoundType },
>(rounds: R[]): BidirectionalDeLayout<R> {
  const sorted = [...rounds].sort((a, b) => a.roundIndex - b.roundIndex);
  const winners = sorted.filter((r) => r.roundType === "WINNERS");
  const losers = sorted.filter(
    (r) => r.roundType === "LOSERS" || r.roundType === "LOSERS_SECOND",
  );
  const finals = sorted.filter((r) => r.roundType === "FINAL");
  const firstLoserIdx = losers[0]?.roundIndex ?? Number.POSITIVE_INFINITY;
  const earlyFinals = finals.filter((f) => f.roundIndex < firstLoserIdx);
  const lateFinals = finals.filter((f) => f.roundIndex >= firstLoserIdx);
  const winnerPath = [...winners, ...earlyFinals].sort((a, b) => a.roundIndex - b.roundIndex);
  const center = winnerPath[0] ?? null;
  const right = [...winnerPath.slice(1), ...lateFinals];
  const left = [...losers].reverse();
  return { left, center, right };
}

/**
 * Schedule / results card line: "{division} · Semifinals" / "Championship" (consolation games use separate copy).
 */
export function playoffScheduleBracketCaption(input: {
  gameKind: GameKind;
  division: { name: string } | null | undefined;
  bracketRound: {
    name: string;
    roundType: BracketRoundType;
  } | null | undefined;
  bracketDivision: { name: string } | null | undefined;
}): string | null {
  if (!input.bracketRound || input.gameKind === "CONSOLATION") return null;

  const divName = input.bracketDivision?.name ?? input.division?.name;
  if (!divName) return null;

  const roundLabel =
    input.bracketRound.roundType === "FINAL" ? "Championship" : input.bracketRound.name;

  return `${divName} · ${roundLabel}`;
}
