import type { BracketSlotFeedKind, Division, Pool } from "@prisma/client";
import { poolFinishPlaceholderLabel } from "@/lib/brackets/bracket-display";
import type { BracketMatchFeederRef, GameRow, TeamWithPool } from "@/components/brackets/bracket-types";

export type SlotLine = {
  primary: string;
  secondary: string | null;
  team: TeamWithPool | null;
  /** Pool-derived or TBD slot — not a concrete team yet */
  isPlaceholder: boolean;
};

export function slotLineTextClass(line: SlotLine): string {
  if (line.team) return "font-bold text-zinc-900";
  if (line.isPlaceholder) return "font-medium italic text-zinc-500";
  return "font-medium text-zinc-900";
}

export function matchSortIndex(g: GameRow): number {
  return g.bracketMatch?.matchIndex ?? g.bracketPosition ?? 0;
}

export function feederGameLabel(from: BracketMatchFeederRef): string {
  const n = from.game?.gameNumber?.trim();
  if (n) return `G${n}`;
  return `Match ${from.matchIndex + 1}`;
}

/** e.g. "G1 Winner" / "G2 Loser" — primary label for empty feeder seats. */
export function explicitFeederPrimary(
  from: BracketMatchFeederRef | null | undefined,
  kind: BracketSlotFeedKind | null | undefined,
): string | null {
  if (!from || !kind) return null;
  const label = feederGameLabel(from);
  return kind === "LOSER" ? `${label} Loser` : `${label} Winner`;
}

function isDirectEntryPool(pool: Pool | null | undefined): boolean {
  return (pool?.name ?? "").trim().toLowerCase() === "direct entry";
}

export function slotLines(
  team: TeamWithPool | null,
  sourcePool: (Pool & { division: Division }) | null | undefined,
  rank: number | null | undefined,
  roundIndex: number,
  bracketMatchIndex: number,
  slot: "home" | "away",
  prevRoundName: string | null,
  isBye = false,
  explicitFeeder: { from: BracketMatchFeederRef | null | undefined; kind: BracketSlotFeedKind | null | undefined } | null = null,
): SlotLine {
  if (isBye) {
    return { primary: "BYE", secondary: null, team: null, isPlaceholder: true };
  }
  if (team) {
    // Bracket-only "Direct entry" pools are not useful under the team name.
    const secondary =
      team.pool && !isDirectEntryPool(team.pool)
        ? `${team.pool.division.name} · ${team.pool.name}`
        : null;
    return { primary: team.name, secondary, team, isPlaceholder: false };
  }
  if (sourcePool && rank != null) {
    return {
      primary: poolFinishPlaceholderLabel(
        sourcePool.division.name,
        sourcePool.name,
        rank,
      ),
      secondary: null,
      team: null,
      isPlaceholder: true,
    };
  }
  const feederPrimary = explicitFeeder
    ? explicitFeederPrimary(explicitFeeder.from, explicitFeeder.kind)
    : null;
  if (feederPrimary) {
    return {
      primary: feederPrimary,
      secondary: null,
      team: null,
      isPlaceholder: true,
    };
  }
  if (roundIndex > 0 && prevRoundName) {
    const feederIdx = slot === "home" ? bracketMatchIndex * 2 : bracketMatchIndex * 2 + 1;
    const matchNo = feederIdx + 1;
    return {
      primary: `Match ${matchNo} Winner`,
      secondary: null,
      team: null,
      isPlaceholder: true,
    };
  }
  return { primary: "TBD", secondary: null, team: null, isPlaceholder: true };
}

/** Previous round name within the visible round list (sorted by roundIndex). */
export function prevRoundNameForGame(
  roundsVisibleSorted: { id: string; name: string; roundIndex: number }[],
  currentRoundId: string | null,
): string | null {
  if (!currentRoundId) return null;
  const ordered = [...roundsVisibleSorted].sort((a, b) => a.roundIndex - b.roundIndex);
  const ix = ordered.findIndex((x) => x.id === currentRoundId);
  return ix > 0 ? ordered[ix - 1]!.name : null;
}
