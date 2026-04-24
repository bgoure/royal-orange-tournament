import { GameResultType, GameStatus } from "@prisma/client";

/** Clears scores, teams, and status for playoff or consolation games (admin bracket / soft reset). */
export const gameCompetitiveResetData = {
  status: GameStatus.SCHEDULED,
  resultType: GameResultType.REGULAR,
  homeTeamId: null,
  awayTeamId: null,
  homeRuns: null,
  awayRuns: null,
  homeDefensiveInnings: null,
  awayDefensiveInnings: null,
  homeOffensiveInnings: null,
  awayOffensiveInnings: null,
} as const;
