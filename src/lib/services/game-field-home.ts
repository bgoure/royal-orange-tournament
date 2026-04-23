import { GameResultType } from "@prisma/client";

export function mapForfeitTypeWhenSwappingSides(rt: GameResultType): GameResultType {
  if (rt === GameResultType.FORFEIT_HOME_WINS) return GameResultType.FORFEIT_AWAY_WINS;
  if (rt === GameResultType.FORFEIT_AWAY_WINS) return GameResultType.FORFEIT_HOME_WINS;
  return rt;
}

export type ScoringSlice = {
  homeRuns: number | null;
  awayRuns: number | null;
  homeDefensiveInnings: number | null;
  awayDefensiveInnings: number | null;
  homeOffensiveInnings: number | null;
  awayOffensiveInnings: number | null;
  resultType: GameResultType;
};

/** Form runs/innings are keyed to current DB away/home; merge director field-home choice into canonical home/away columns (swap when needed). */
export function applyFieldHomeToScoring(
  existingHomeTeamId: string | null,
  existingAwayTeamId: string | null,
  fieldHomeTeamId: string,
  scoring: ScoringSlice,
): ScoringSlice & { homeTeamId: string | null; awayTeamId: string | null } {
  if (!existingHomeTeamId || !existingAwayTeamId) {
    throw new Error("Both teams must be assigned before recording field home.");
  }
  if (fieldHomeTeamId !== existingHomeTeamId && fieldHomeTeamId !== existingAwayTeamId) {
    throw new Error("Field home must be one of the two teams in this game.");
  }
  if (fieldHomeTeamId === existingHomeTeamId) {
    return {
      homeTeamId: existingHomeTeamId,
      awayTeamId: existingAwayTeamId,
      ...scoring,
    };
  }
  return {
    homeTeamId: existingAwayTeamId,
    awayTeamId: existingHomeTeamId,
    homeRuns: scoring.awayRuns,
    awayRuns: scoring.homeRuns,
    homeDefensiveInnings: scoring.awayDefensiveInnings,
    awayDefensiveInnings: scoring.homeDefensiveInnings,
    homeOffensiveInnings: scoring.awayOffensiveInnings,
    awayOffensiveInnings: scoring.homeOffensiveInnings,
    resultType: mapForfeitTypeWhenSwappingSides(scoring.resultType),
  };
}

/** When `fieldHomeTeamId` is missing/blank, keep existing home/away rows (TBD matchups or legacy submits). */
export function applyFieldHomeToScoringOptional(
  existingHomeTeamId: string | null,
  existingAwayTeamId: string | null,
  fieldHomeTeamId: string | null | undefined,
  scoring: ScoringSlice,
): ScoringSlice & { homeTeamId: string | null; awayTeamId: string | null } {
  const fid = fieldHomeTeamId?.trim() ?? "";
  if (!fid) {
    return {
      homeTeamId: existingHomeTeamId,
      awayTeamId: existingAwayTeamId,
      ...scoring,
    };
  }
  return applyFieldHomeToScoring(existingHomeTeamId, existingAwayTeamId, fid, scoring);
}
