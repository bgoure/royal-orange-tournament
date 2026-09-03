import { GameStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { advanceBracketWinnerFromGame } from "@/lib/services/bracket-advance";
import { recomputePoolStandings } from "@/lib/services/standings";

const scoreGameSelect = {
  id: true,
  poolId: true,
  bracketId: true,
  status: true,
  homeRuns: true,
  awayRuns: true,
  updatedAt: true,
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
} satisfies Prisma.GameSelect;

export type ScoredGame = Prisma.GameGetPayload<{ select: typeof scoreGameSelect }>;

export type ApplyGameScoreResult =
  | { ok: true; game: ScoredGame }
  | { ok: false; reason: "not-found" }
  /** Another writer changed the game since `expectedUpdatedAt`; `game` is the current server state. */
  | { ok: false; reason: "conflict"; game: ScoredGame };

export type ApplyGameScoreInput = {
  gameId: string;
  tournamentId: string;
  homeRuns: number;
  awayRuns: number;
  markFinal: boolean;
  /** Optimistic concurrency token — the `updatedAt` the caller believes it is overwriting. */
  expectedUpdatedAt?: Date | null;
};

/**
 * `Game.updatedAt` doubles as the optimistic-concurrency token, and Prisma stores it at
 * millisecond resolution. Writing an explicit value that is strictly greater than the token we
 * just consumed guarantees the token changes even when two writes land in the same millisecond,
 * so a second writer holding the old token can never match the row again.
 */
function nextConcurrencyToken(expectedUpdatedAt: Date | null | undefined): Date {
  const floor = expectedUpdatedAt ? expectedUpdatedAt.getTime() + 1 : 0;
  return new Date(Math.max(Date.now(), floor));
}

/**
 * Write a game score with optimistic concurrency, then bring derived state back in sync.
 *
 * The guard is part of the write itself (`updateMany ... WHERE id = ? AND updatedAt = ?`) rather
 * than a read/compare/write, so two devices submitting against the same `expectedUpdatedAt` can
 * never both win: the loser's statement matches zero rows and comes back as a conflict.
 *
 * The winning write and the pool standings it invalidates share one transaction, so a failure
 * mid-way leaves neither applied. Bracket advancement runs after that commit — it walks many
 * rows across the bracket and is idempotent (seats are only filled when empty, and re-placing a
 * team it already seated is a no-op), so a retry of the whole request converges on the same
 * result rather than double-advancing.
 */
export async function applyGameScore(input: ApplyGameScoreInput): Promise<ApplyGameScoreResult> {
  const written = await prisma.$transaction(
    async (tx) => {
      const result = await tx.game.updateMany({
        where: {
          id: input.gameId,
          tournamentId: input.tournamentId,
          ...(input.expectedUpdatedAt ? { updatedAt: input.expectedUpdatedAt } : {}),
        },
        data: {
          homeRuns: input.homeRuns,
          awayRuns: input.awayRuns,
          ...(input.markFinal ? { status: GameStatus.FINAL } : {}),
          updatedAt: nextConcurrencyToken(input.expectedUpdatedAt),
        },
      });
      if (result.count === 0) return null;

      const game = await tx.game.findUniqueOrThrow({
        where: { id: input.gameId },
        select: scoreGameSelect,
      });
      if (game.poolId) await recomputePoolStandings(game.poolId, tx);
      return game;
    },
    { timeout: 20_000 },
  );

  if (!written) {
    const latest = await prisma.game.findFirst({
      where: { id: input.gameId, tournamentId: input.tournamentId },
      select: scoreGameSelect,
    });
    if (!latest) return { ok: false, reason: "not-found" };
    return { ok: false, reason: "conflict", game: latest };
  }

  if (input.markFinal && written.bracketId) {
    await advanceBracketWinnerFromGame(written.id);
  }

  return { ok: true, game: written };
}

/** Wire shape for both the 200 and 409 payloads of the score endpoint. */
export function serializeScoredGame(game: ScoredGame) {
  return {
    id: game.id,
    status: game.status,
    homeRuns: game.homeRuns,
    awayRuns: game.awayRuns,
    updatedAt: game.updatedAt.toISOString(),
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
  };
}
