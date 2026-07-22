import { GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk, resolveApiUser } from "@/lib/api/v1/auth";
import { can } from "@/lib/rbac/permissions";
import { assertGameDivisionScope } from "@/lib/rbac/division-scope";
import { advanceBracketWinnerFromGame } from "@/lib/services/bracket-advance";
import { recomputePoolStandings } from "@/lib/services/standings";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";

/**
 * Staff score submission. Same RBAC as admin updateGameScoring.
 * Optional `expectedUpdatedAt` (ISO) enables optimistic concurrency for Expo offline queues:
 * if the server's Game.updatedAt is newer, respond 409 with the current game snapshot.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; gameId: string }> },
) {
  const user = await resolveApiUser(req);
  if (!user) return jsonError("Unauthorized", 401);
  if (!can(user.role, "game:update")) return jsonError("Forbidden", 403);

  const { slug, gameId } = await ctx.params;
  const t = await prisma.tournament.findFirst({
    where: { slug, isPublished: true, archivedAt: null },
    select: { id: true },
  });
  if (!t) return jsonError("Tournament not found", 404);

  const scopeErr = await assertGameDivisionScope(user.id, user.role, gameId);
  if (scopeErr) return jsonError(scopeErr, 403);

  const body = (await req.json().catch(() => null)) as {
    homeRuns?: unknown;
    awayRuns?: unknown;
    status?: unknown;
    expectedUpdatedAt?: unknown;
  } | null;
  const homeRuns = body?.homeRuns;
  const awayRuns = body?.awayRuns;
  if (
    typeof homeRuns !== "number" ||
    !Number.isInteger(homeRuns) ||
    homeRuns < 0 ||
    typeof awayRuns !== "number" ||
    !Number.isInteger(awayRuns) ||
    awayRuns < 0
  ) {
    return jsonError("homeRuns and awayRuns are required non-negative integers", 400);
  }
  if (body?.status !== undefined && body.status !== GameStatus.FINAL) {
    return jsonError('status must be omitted or "FINAL"', 400);
  }
  const markFinal = body?.status === GameStatus.FINAL;

  let expectedMs: number | null = null;
  if (body?.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== null) {
    if (typeof body.expectedUpdatedAt !== "string") {
      return jsonError("expectedUpdatedAt must be an ISO timestamp string", 400);
    }
    expectedMs = Date.parse(body.expectedUpdatedAt);
    if (Number.isNaN(expectedMs)) {
      return jsonError("expectedUpdatedAt must be a valid ISO timestamp", 400);
    }
  }

  const game = await prisma.game.findFirst({
    where: { id: gameId, tournamentId: t.id },
    select: {
      id: true,
      poolId: true,
      bracketId: true,
      updatedAt: true,
      status: true,
      homeRuns: true,
      awayRuns: true,
    },
  });
  if (!game) return jsonError("Game not found", 404);

  if (expectedMs != null && game.updatedAt.getTime() > expectedMs) {
    return Response.json(
      {
        error: "Game was updated elsewhere. Refresh and retry.",
        game: {
          id: game.id,
          updatedAt: game.updatedAt.toISOString(),
          status: game.status,
          homeRuns: game.homeRuns,
          awayRuns: game.awayRuns,
        },
      },
      { status: 409 },
    );
  }

  await prisma.game.update({
    where: { id: game.id },
    data: { homeRuns, awayRuns, ...(markFinal ? { status: GameStatus.FINAL } : {}) },
  });

  if (game.poolId) await recomputePoolStandings(game.poolId);
  if (markFinal && game.bracketId) await advanceBracketWinnerFromGame(game.id);
  await revalidatePublishedTournamentSites();

  const updated = await prisma.game.findUnique({
    where: { id: game.id },
    select: {
      id: true,
      status: true,
      homeRuns: true,
      awayRuns: true,
      updatedAt: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
  });

  return jsonOk({
    game: updated
      ? {
          ...updated,
          updatedAt: updated.updatedAt.toISOString(),
        }
      : null,
  });
}
