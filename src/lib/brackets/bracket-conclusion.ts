import { BracketRoundType, GameStatus } from "@prisma/client";
import type { BracketWith, TeamWithPool } from "@/components/brackets/bracket-types";
import { aliveTeamIds, bracketWinnerTeamId } from "@/lib/services/bracket-engine";

export type ResolvedBracketOutcome = {
  divisionName: string;
  /** Primary banner team (champion or first qualifier). */
  winnerTeam: TeamWithPool;
  /** All advancing / remaining teams when the bracket has concluded. */
  qualifiedTeams: TeamWithPool[];
  isQualifier: boolean;
  qualifyingTeamCount: number;
  concluded: boolean;
};

function teamFromGames(bracket: BracketWith, teamId: string): TeamWithPool | null {
  for (const g of bracket.games) {
    if (g.homeTeamId === teamId && g.homeTeam?.name) return g.homeTeam;
    if (g.awayTeamId === teamId && g.awayTeam?.name) return g.awayTeam;
  }
  return null;
}

/**
 * Every team that has appeared in a bracket game.
 * Do not use Round 1 alone — OBA seeded maps give byes to top seeds who never play R1.
 */
export function entrantIdsFromBracket(bracket: BracketWith): string[] {
  const ids = new Set<string>();
  for (const g of bracket.games) {
    if (g.homeTeamId) ids.add(g.homeTeamId);
    if (g.awayTeamId) ids.add(g.awayTeamId);
  }
  return [...ids];
}

/** Winner of a completed championship / if-necessary series, or null if still open. */
function resolveChampionshipSeriesWinner(bracket: BracketWith): TeamWithPool | null {
  const finalRound = bracket.rounds.find((r) => r.roundType === BracketRoundType.FINAL);
  if (!finalRound) return null;

  const finalGames = bracket.games
    .filter((g) => g.bracketRoundId === finalRound.id)
    .sort((a, b) => (a.bracketPosition ?? 999) - (b.bracketPosition ?? 999));

  if (finalGames.length === 0) return null;

  const gf1 = finalGames[0]!;
  const gf2 = finalGames[1] ?? null;

  if (bracket.grandFinalMode === "IF_NECESSARY" && gf2) {
    if (gf1.status === GameStatus.FINAL) {
      const w1 = bracketWinnerTeamId(gf1);
      if (w1 && w1 === gf1.homeTeamId) {
        const winnerTeam =
          gf1.homeTeamId === w1 ? gf1.homeTeam : gf1.awayTeamId === w1 ? gf1.awayTeam : null;
        if (winnerTeam?.name) return winnerTeam;
      }
    }
    if (gf2.status === GameStatus.FINAL) {
      const w2 = bracketWinnerTeamId(gf2);
      if (!w2) return null;
      const winnerTeam =
        gf2.homeTeamId === w2 ? gf2.homeTeam : gf2.awayTeamId === w2 ? gf2.awayTeam : null;
      if (winnerTeam?.name) return winnerTeam;
    }
    return null;
  }

  for (const game of finalGames) {
    if (game.status !== GameStatus.FINAL) continue;
    const winnerId = bracketWinnerTeamId(game);
    if (!winnerId) continue;
    const winnerTeam =
      game.homeTeamId === winnerId
        ? game.homeTeam
        : game.awayTeamId === winnerId
          ? game.awayTeam
          : null;
    if (winnerTeam?.name) return winnerTeam;
  }

  return null;
}

/**
 * Resolve champion / qualifiers for public UI.
 * - Normal: FINAL series complete → single champion (GF2 if if-necessary).
 * - Qualifier: championship series done, or enough teams eliminated that ≤ N remain alive.
 *
 * Never crown from `concludedAt` alone or from “N teams seeded with zero losses” —
 * after a bracket reset that would falsely congratulate the first assigned team.
 */
export function resolveBracketOutcome(bracket: BracketWith): ResolvedBracketOutcome | null {
  const isQualifier = bracket.isQualifier === true;
  const qualifyingTeamCount = Math.max(1, bracket.qualifyingTeamCount ?? 1);
  const divisionName = bracket.division.name;
  const seriesWinner = resolveChampionshipSeriesWinner(bracket);

  if (isQualifier || qualifyingTeamCount > 1) {
    const entrants = entrantIdsFromBracket(bracket);
    const alive = aliveTeamIds({
      format: bracket.format,
      entrantTeamIds: entrants,
      games: bracket.games,
    });
    // Require real eliminations (alive < field) so empty/reset brackets never conclude.
    const fieldReducedToQualifiers =
      entrants.length > qualifyingTeamCount &&
      alive.length > 0 &&
      alive.length <= qualifyingTeamCount &&
      alive.length < entrants.length;
    const concluded = seriesWinner != null || fieldReducedToQualifiers;

    if (!concluded) return null;

    const aliveTeams = alive
      .map((id) => teamFromGames(bracket, id))
      .filter((t): t is TeamWithPool => t != null && Boolean(t.name));

    let qualifiedTeams = aliveTeams;
    if (seriesWinner) {
      const rest = aliveTeams.filter((t) => t.id !== seriesWinner.id);
      qualifiedTeams = [seriesWinner, ...rest];
    }

    if (qualifiedTeams.length === 0 && seriesWinner) {
      qualifiedTeams = [seriesWinner];
    }
    if (qualifiedTeams.length === 0) return null;

    return {
      divisionName,
      winnerTeam: seriesWinner ?? qualifiedTeams[0]!,
      qualifiedTeams,
      isQualifier: true,
      qualifyingTeamCount,
      concluded: true,
    };
  }

  if (!seriesWinner) return null;

  return {
    divisionName,
    winnerTeam: seriesWinner,
    qualifiedTeams: [seriesWinner],
    isQualifier: false,
    qualifyingTeamCount: 1,
    concluded: true,
  };
}

/** Back-compat wrapper used by existing call sites. */
export function resolveChampionFromBracket(bracket: BracketWith) {
  const outcome = resolveBracketOutcome(bracket);
  if (!outcome) return null;
  return {
    divisionName: outcome.divisionName,
    winnerTeam: outcome.winnerTeam,
    qualifiedTeams: outcome.qualifiedTeams,
    isQualifier: outcome.isQualifier,
  };
}
