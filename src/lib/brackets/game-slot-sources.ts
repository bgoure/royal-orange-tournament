import type { Division, Pool } from "@prisma/client";
import type { GameRow } from "@/components/brackets/bracket-types";

type SourcePool = (Pool & { division: Division }) | null;

/** Pool + finish rank for bracket round 0 or consolation seeding lines. */
export function getBracketSlotSources(game: GameRow): {
  awayPool: SourcePool;
  awayRank: number | null;
  homePool: SourcePool;
  homeRank: number | null;
} {
  const bm = game.bracketMatch;
  if (bm) {
    return {
      awayPool: bm.awaySourcePool,
      awayRank: bm.awaySourceRank,
      homePool: bm.homeSourcePool,
      homeRank: bm.homeSourceRank,
    };
  }
  if (game.gameKind === "CONSOLATION") {
    return {
      awayPool: game.consolationAwayPool ?? null,
      awayRank: game.consolationAwayRank,
      homePool: game.consolationHomePool ?? null,
      homeRank: game.consolationHomeRank,
    };
  }
  return {
    awayPool: null,
    awayRank: null,
    homePool: null,
    homeRank: null,
  };
}
