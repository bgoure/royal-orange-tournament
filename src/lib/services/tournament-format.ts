import { GameKind } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * True when this event looks like wizard "bracket only":
 * no pool (round-robin) games, and every pool is the Direct entry placeholder.
 */
export async function isBracketOnlyTournament(tournamentId: string): Promise<boolean> {
  const [poolGameCount, pools] = await Promise.all([
    prisma.game.count({
      where: { tournamentId, gameKind: GameKind.POOL },
    }),
    prisma.pool.findMany({
      where: { division: { tournamentId } },
      select: { name: true },
    }),
  ]);
  if (poolGameCount > 0) return false;
  if (pools.length === 0) return true;
  return pools.every((p) => p.name.trim().toLowerCase() === "direct entry");
}
