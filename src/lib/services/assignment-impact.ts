import type { GameResultType, GameStatus } from "@prisma/client";

/**
 * Round-1 (and similar) reseating lock: LIVE always; FINAL only when the result was a real game.
 * FINAL + FORFEIT_* (BYE walkovers) remain reseatable.
 */
export function isCompetitiveSeatLocked(game: {
  status: GameStatus | string;
  resultType: GameResultType | string | null | undefined;
}): boolean {
  if (game.status === "LIVE") return true;
  if (game.status === "FINAL" && (game.resultType ?? "REGULAR") === "REGULAR") return true;
  return false;
}

export type AssignmentImpactSummary = {
  /** Games that block ordinary reassignment (LIVE or FINAL REGULAR). */
  lockedGames: number;
  /** Other games still listing any of the moved teams (scheduled, postponed, etc.). */
  scheduledGames: number;
  /** True when a published playoff bracket exists for an affected division. */
  publishedBracket: boolean;
  /** Division ids that have a published bracket among the affected set. */
  publishedBracketDivisionIds: string[];
};

export function formatPoolAssignmentImpactMessage(impact: AssignmentImpactSummary): string {
  const parts: string[] = [];
  if (impact.scheduledGames > 0) {
    parts.push(
      `${impact.scheduledGames} scheduled game${impact.scheduledGames === 1 ? "" : "s"}`,
    );
  }
  if (impact.publishedBracket) {
    parts.push("the published bracket");
  }
  if (impact.lockedGames > 0) {
    parts.push(
      `${impact.lockedGames} live or scored game${impact.lockedGames === 1 ? "" : "s"}`,
    );
  }
  const affected = parts.length > 0 ? parts.join(" and ") : "existing competition data";
  return `Moving these teams would affect ${affected}. Reset the affected competition structure before continuing.`;
}

export function formatSeedBoardImpactMessage(clearedLaterSeats: number): string {
  return `Saving Round 1 seeding will clear ${clearedLaterSeats} later-round seat${
    clearedLaterSeats === 1 ? "" : "s"
  } that still have teams assigned (unplayed games only). Confirm you intend to re-seed, or reset the bracket from Structure / Brackets first. This save will not delete the bracket or regenerate the schedule automatically.`;
}
