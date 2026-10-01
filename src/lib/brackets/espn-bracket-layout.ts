import type { GameRow } from "@/components/brackets/bracket-types";
import { matchSortIndex } from "@/components/brackets/bracket-slot-lines";

export type EspnConnectorGroup = {
  /** Destination match in the later column. */
  toGameId: string;
  /** Feeder game ids from the earlier column (0–2), sorted by match index. */
  fromGameIds: string[];
};

/**
 * Build ESPN-style elbow groups between two adjacent single-elim columns.
 * Prefers explicit feeder links; falls back to classic power-of-2 pairing
 * (matches 2i / 2i+1 → next match i).
 */
export function espnConnectorGroups(
  earlierGames: GameRow[],
  laterGames: GameRow[],
): EspnConnectorGroup[] {
  const earlier = [...earlierGames].sort((a, b) => matchSortIndex(a) - matchSortIndex(b));
  const later = [...laterGames].sort((a, b) => matchSortIndex(a) - matchSortIndex(b));
  if (earlier.length === 0 || later.length === 0) return [];

  const earlierIds = new Set(earlier.map((g) => g.id));
  const groups: EspnConnectorGroup[] = [];

  for (const dest of later) {
    const bm = dest.bracketMatch;
    const fromIds: string[] = [];
    const homeFrom = bm?.homeFromMatch?.game?.id;
    const awayFrom = bm?.awayFromMatch?.game?.id;
    if (homeFrom && earlierIds.has(homeFrom)) fromIds.push(homeFrom);
    if (awayFrom && earlierIds.has(awayFrom) && awayFrom !== homeFrom) fromIds.push(awayFrom);

    if (fromIds.length > 0) {
      fromIds.sort((a, b) => {
        const ga = earlier.find((g) => g.id === a)!;
        const gb = earlier.find((g) => g.id === b)!;
        return matchSortIndex(ga) - matchSortIndex(gb);
      });
      groups.push({ toGameId: dest.id, fromGameIds: fromIds });
      continue;
    }

    // Classic power-of-2: next match i is fed by earlier 2i and 2i+1.
    const mi = dest.bracketMatch?.matchIndex ?? later.indexOf(dest);
    const a = earlier[mi * 2];
    const b = earlier[mi * 2 + 1];
    const fallback = [a?.id, b?.id].filter((id): id is string => !!id);
    if (fallback.length > 0) {
      groups.push({ toGameId: dest.id, fromGameIds: fallback });
    }
  }

  return groups;
}

/** True when successive columns follow classic halving (ESPN flex slots align). */
export function espnRoundsHalveCleanly(counts: number[]): boolean {
  if (counts.length < 2) return true;
  for (let i = 1; i < counts.length; i++) {
    const prev = counts[i - 1]!;
    const next = counts[i]!;
    if (next < 1 || prev < 1) return false;
    // Allow equal counts (IF necessary / GF2) or exact half.
    if (next !== prev && next * 2 !== prev && next !== Math.ceil(prev / 2)) {
      return false;
    }
  }
  return true;
}
