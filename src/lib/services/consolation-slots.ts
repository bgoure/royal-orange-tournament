import { GameKind } from "@prisma/client";
import { prisma } from "@/lib/db";

function slotKey(poolId: string, rank: number) {
  return `${poolId}:${rank}`;
}

/**
 * Ensures home/away pool+rank slots are not already used by another consolation game in the division.
 */
export async function assertConsolationSlotsAvailable(
  divisionId: string,
  home: { poolId: string; rank: number },
  away: { poolId: string; rank: number },
  excludeGameId?: string,
): Promise<void> {
  const games = await prisma.game.findMany({
    where: { divisionId, gameKind: GameKind.CONSOLATION },
    select: {
      id: true,
      consolationHomePoolId: true,
      consolationHomeRank: true,
      consolationAwayPoolId: true,
      consolationAwayRank: true,
    },
  });

  const used = new Set<string>();
  for (const g of games) {
    if (g.id === excludeGameId) continue;
    if (g.consolationHomePoolId != null && g.consolationHomeRank != null) {
      used.add(slotKey(g.consolationHomePoolId, g.consolationHomeRank));
    }
    if (g.consolationAwayPoolId != null && g.consolationAwayRank != null) {
      used.add(slotKey(g.consolationAwayPoolId, g.consolationAwayRank));
    }
  }

  const attempt = [slotKey(home.poolId, home.rank), slotKey(away.poolId, away.rank)];
  for (const k of attempt) {
    if (used.has(k)) {
      throw new Error(
        `That pool finishing slot (${k.replace(":", " · rank ")}) is already assigned in another consolation game in this division. Pick a different rank or pool.`,
      );
    }
  }
}
