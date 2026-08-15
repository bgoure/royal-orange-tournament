import type { BracketWith, TeamWithPool } from "@/components/brackets/bracket-types";
import type { PoolForDivisionTabs } from "@/lib/division-tabs";
import { entityDivisionMatchesTab } from "@/lib/division-tabs";
import { listBracketsForTournament } from "@/lib/services/brackets";
import {
  resolveBracketOutcome,
  resolveChampionFromBracket as resolveChampionFromOutcome,
} from "@/lib/brackets/bracket-conclusion";

export type ResolvedBracketChampion = {
  divisionName: string;
  winnerTeam: TeamWithPool;
  qualifiedTeams?: TeamWithPool[];
  isQualifier?: boolean;
  qualifyingTeamCount?: number;
};

export { resolveBracketOutcome };

/** Trophy / “Congratulations” banner is for a single champion, not top-N qualifier fields. */
export function shouldShowChampionCelebration(
  champion: Pick<ResolvedBracketChampion, "isQualifier" | "qualifyingTeamCount"> | null,
): boolean {
  if (!champion) return false;
  const n = Math.max(1, champion.qualifyingTeamCount ?? 1);
  return n < 2;
}

/**
 * When the championship / qualifier conclusion rules are met, returns the primary
 * winner (and optional qualified list).
 */
export function resolveChampionFromBracket(bracket: BracketWith): ResolvedBracketChampion | null {
  return resolveChampionFromOutcome(bracket);
}

/** First published bracket matching the division tab that has a decided champion/qualifiers. */
export async function getBracketChampionForDivisionTab(
  tournamentId: string,
  tabId: string,
  poolsForTabs: PoolForDivisionTabs[],
): Promise<ResolvedBracketChampion | null> {
  if (!tabId) return null;
  const brackets = await listBracketsForTournament(tournamentId, { publishedOnly: true });
  const matching = brackets
    .filter((b) => entityDivisionMatchesTab(b.divisionId, tabId, poolsForTabs))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  for (const b of matching) {
    const r = resolveChampionFromBracket(b);
    if (r && shouldShowChampionCelebration(r)) return r;
  }
  return null;
}
