import { GameKind } from "@prisma/client";
import { prisma } from "@/lib/db";

function isDirectEntryPoolName(name: string): boolean {
  return /direct\s*entry/i.test(name.trim());
}

/**
 * True when this event is bracket-only (no pool standings / Results page).
 * Prefers the explicit Tournament.hasPoolPlay flag; falls back to heuristics.
 */
export async function isBracketOnlyTournament(tournamentId: string): Promise<boolean> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { hasPoolPlay: true },
  });
  if (tournament && tournament.hasPoolPlay === false) return true;

  const [poolGameCount, pools, presetBracketCount] = await Promise.all([
    prisma.game.count({
      where: { tournamentId, gameKind: GameKind.POOL },
    }),
    prisma.pool.findMany({
      where: { division: { tournamentId } },
      select: { name: true },
    }),
    prisma.bracket.count({
      where: { tournamentId, presetKey: { not: null } },
    }),
  ]);

  if (poolGameCount > 0) return false;
  if (presetBracketCount > 0) return true;
  if (pools.length === 0) return true;
  return pools.every((p) => isDirectEntryPoolName(p.name));
}
