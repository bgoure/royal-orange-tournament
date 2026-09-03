import type { Prisma } from "@prisma/client";

/** Minimal bracket-match shape for in-memory public visibility checks. */
export type PublicPlayableBracketMatch = {
  homeIsBye: boolean;
  awayIsBye: boolean;
} | null;

export type PublicPlayableGameLike = {
  bracketMatch: PublicPlayableBracketMatch;
};

/**
 * Games linked to a BracketMatch with a structural bye flag are internal bracket-control
 * rows (first-round padding, OBA sit-outs), not playable public schedule entries.
 * Pool games and legitimate feeder/TBD bracket slots remain visible.
 */
export function isPublicPlayableGame(game: PublicPlayableGameLike): boolean {
  const bm = game.bracketMatch;
  if (!bm) return true;
  return !bm.homeIsBye && !bm.awayIsBye;
}

/** Prisma filter: exclude structural bye / sit-out bracket slots from public listings. */
export function publicPlayableGameClause(): Prisma.GameWhereInput {
  return {
    NOT: {
      bracketMatch: {
        is: {
          OR: [{ homeIsBye: true }, { awayIsBye: true }],
        },
      },
    },
  };
}
