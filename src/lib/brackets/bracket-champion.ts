import { BracketRoundType, GameStatus } from "@prisma/client";
import type { BracketWith, TeamWithPool } from "@/components/brackets/bracket-types";
import type { PoolForDivisionTabs } from "@/lib/division-tabs";
import { entityDivisionMatchesTab } from "@/lib/division-tabs";
import { bracketWinnerTeamId } from "@/lib/services/bracket-engine";
import { listBracketsForTournament } from "@/lib/services/brackets";

export type ResolvedBracketChampion = {
  divisionName: string;
  winnerTeam: TeamWithPool;
};

/**
 * When the championship round game is FINAL with a decided winner, returns the winning team.
 * No published bracket, no FINAL round, non-FINAL game, or tie → null.
 */
export function resolveChampionFromBracket(bracket: BracketWith): ResolvedBracketChampion | null {
  const finalRound = bracket.rounds.find((r) => r.roundType === BracketRoundType.FINAL);
  if (!finalRound) return null;

  const finalGames = bracket.games
    .filter((g) => g.bracketRoundId === finalRound.id)
    .sort((a, b) => (a.bracketPosition ?? 999) - (b.bracketPosition ?? 999));

  for (const game of finalGames) {
    if (game.status !== GameStatus.FINAL) continue;
    const winnerId = bracketWinnerTeamId(game);
    if (!winnerId) continue;
    const winnerTeam =
      game.homeTeamId === winnerId ? game.homeTeam : game.awayTeamId === winnerId ? game.awayTeam : null;
    if (winnerTeam?.name) {
      return { divisionName: bracket.division.name, winnerTeam };
    }
  }

  return null;
}

/** First published bracket matching the division tab (real or synthetic age) that has a decided champion. */
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
    if (r) return r;
  }
  return null;
}
