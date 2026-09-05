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

export type ChronologicalRoundColumn<G> = {
  /** Display header, e.g. "Round 1". */
  label: string;
  /** Optional secondary line under the header. */
  subtitle?: string;
  /** Accent index for alternating column colors (0–2). */
  accentIndex: number;
  games: G[];
};

/**
 * Group bracket rounds into left→right "Round N" columns (workbook-style).
 * A FINAL round with two games becomes Round 6 (championship) + Round 7 (if necessary)
 * when earlier rounds are already named Round 1…N; otherwise "Championship" / "If necessary".
 */
export function chronologicalRoundColumns<
  R extends { id: string; name: string; roundIndex: number; roundType: BracketRoundType },
  G extends { id: string; gameNumber?: string | null; bracketPosition?: number | null },
>(rounds: R[], gamesByRoundId: Map<string, G[]>): ChronologicalRoundColumn<G>[] {
  const sorted = [...rounds].sort((a, b) => a.roundIndex - b.roundIndex);
  const columns: ChronologicalRoundColumn<G>[] = [];
  let accent = 0;

  const sortGames = (games: G[]) =>
    [...games].sort((a, b) => {
      const na = Number.parseInt(String(a.gameNumber ?? ""), 10);
      const nb = Number.parseInt(String(b.gameNumber ?? ""), 10);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0);
    });

  for (const round of sorted) {
    const games = sortGames(gamesByRoundId.get(round.id) ?? []);
    if (games.length === 0) continue;
    if (round.roundType === "FINAL" && games.length >= 2) {
      const priorRoundNames = columns.filter((c) => /^round\s+\d+/i.test(c.label)).length;
      const champLabel = priorRoundNames > 0 ? `Round ${priorRoundNames + 1}` : "Championship";
      const ifNecLabel = priorRoundNames > 0 ? `Round ${priorRoundNames + 2}` : "If necessary";
      columns.push({
        label: champLabel,
        subtitle: "Championship",
        accentIndex: accent % 3,
        games: [games[0]!],
      });
      accent += 1;
      columns.push({
        label: ifNecLabel,
        subtitle: "Championship (if necessary)",
        accentIndex: accent % 3,
        games: [games[1]!],
      });
      accent += 1;
      continue;
    }

    columns.push({
      label: round.name,
      subtitle: round.roundType === "FINAL" ? "Championship" : undefined,
      accentIndex: accent % 3,
      games,
    });
    accent += 1;
  }

  return columns;
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

  const roundLabel = playoffScheduleRoundOnlyLabel(input);
  if (!roundLabel) return null;

  return `${divName} · ${roundLabel}`;
}

/** Round label only (no division), for completed bracket-only schedule / home cards. */
export function playoffScheduleRoundOnlyLabel(input: {
  gameKind: GameKind;
  bracketRound: {
    name: string;
    roundType: BracketRoundType;
  } | null | undefined;
}): string | null {
  if (!input.bracketRound || input.gameKind === "CONSOLATION") return null;
  return input.bracketRound.roundType === "FINAL" ? "Championship" : input.bracketRound.name;
}
