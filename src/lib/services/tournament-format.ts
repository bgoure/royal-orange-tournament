import { GameKind } from "@prisma/client";
import { prisma } from "@/lib/db";

function isDirectEntryPoolName(name: string): boolean {
  return /direct\s*entry/i.test(name.trim());
}

/**
 * True when this event is bracket-only (no pool standings / Results page).
 *
 * Order:
 * 1. Explicit Tournament.hasPoolPlay === false
 * 2. No POOL games + (playoff/consolation games, any bracket, or only Direct entry pools)
 */
export async function isBracketOnlyTournament(tournamentId: string): Promise<boolean> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { hasPoolPlay: true },
  });
  if (tournament?.hasPoolPlay === false) return true;

  const poolGameCount = await prisma.game.count({
    where: { tournamentId, gameKind: GameKind.POOL },
  });
  if (poolGameCount > 0) return false;

  const [playoffOrConsolationCount, bracketCount, pools] = await Promise.all([
    prisma.game.count({
      where: {
        tournamentId,
        gameKind: { in: [GameKind.PLAYOFF, GameKind.CONSOLATION] },
      },
    }),
    prisma.bracket.count({ where: { tournamentId } }),
    prisma.pool.findMany({
      where: { division: { tournamentId } },
      select: { name: true },
    }),
  ]);

  if (playoffOrConsolationCount > 0) return true;
  if (bracketCount > 0) return true;
  if (pools.length === 0) return true;
  return pools.every((p) => isDirectEntryPoolName(p.name));
}
