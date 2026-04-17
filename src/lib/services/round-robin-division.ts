import { GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Pool games that still block playoff seeding from standings (must be played or cancelled). */
const BLOCKING_POOL_STATUSES: GameStatus[] = [
  GameStatus.SCHEDULED,
  GameStatus.LIVE,
  GameStatus.POSTPONED,
];

/**
 * Count of pool games in this division that are not yet final/cancelled.
 * Only games with a pool in the division are counted (not playoff rows).
 */
export async function countIncompleteDivisionPoolGames(
  tournamentId: string,
  divisionId: string,
): Promise<number> {
  return prisma.game.count({
    where: {
      tournamentId,
      pool: { divisionId },
      status: { in: BLOCKING_POOL_STATUSES },
    },
  });
}

export async function isDivisionRoundRobinCompleteForSeeding(
  tournamentId: string,
  divisionId: string,
): Promise<boolean> {
  const n = await countIncompleteDivisionPoolGames(tournamentId, divisionId);
  return n === 0;
}

/**
 * Throws when pool play still has games that are not FINAL or CANCELLED.
 * Call before applying standings to playoff seeds.
 */
export async function assertDivisionRoundRobinCompleteForSeeding(
  tournamentId: string,
  divisionId: string,
): Promise<void> {
  const open = await countIncompleteDivisionPoolGames(tournamentId, divisionId);
  if (open > 0) {
    throw new Error(
      `Round robin is not finished: ${open} pool game(s) in this division are still scheduled, live, or postponed. Complete or cancel those games before seeding the playoff bracket from standings.`,
    );
  }
}
