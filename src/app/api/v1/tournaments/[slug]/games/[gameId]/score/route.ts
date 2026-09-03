import { GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk, resolveApiUser } from "@/lib/api/v1/auth";
import { can } from "@/lib/rbac/permissions";
import { assertGameDivisionScope } from "@/lib/rbac/division-scope";
import { assertUserCanAccessTournament } from "@/lib/rbac/tenant-access";
import { applyGameScore, serializeScoredGame } from "@/lib/services/game-score-write";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";

/**
 * Staff score submission. Same RBAC as admin updateGameScoring.
 * Optional `expectedUpdatedAt` (ISO) enables optimistic concurrency for Expo offline queues:
 * the guard is applied inside the write, so if another device already moved the game on we
 * respond 409 with the current server snapshot instead of overwriting it.
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

  const access = await assertUserCanAccessTournament({ userId: user.id, role: user.role }, { id: t.id });
  if (!access.ok) return jsonError(access.error, access.status);

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

  let expectedUpdatedAt: Date | null = null;
  if (body?.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== null) {
    if (typeof body.expectedUpdatedAt !== "string") {
      return jsonError("expectedUpdatedAt must be an ISO timestamp string", 400);
    }
    const expectedMs = Date.parse(body.expectedUpdatedAt);
    if (Number.isNaN(expectedMs)) {
      return jsonError("expectedUpdatedAt must be a valid ISO timestamp", 400);
    }
    expectedUpdatedAt = new Date(expectedMs);
  }

  const result = await applyGameScore({
    gameId,
    tournamentId: t.id,
    homeRuns,
    awayRuns,
    markFinal,
    expectedUpdatedAt,
  });

  if (!result.ok) {
    if (result.reason === "not-found") return jsonError("Game not found", 404);
    return Response.json(
      {
        error: "Game was updated elsewhere. Refresh and retry.",
        game: serializeScoredGame(result.game),
      },
      { status: 409 },
    );
  }

  await revalidatePublishedTournamentSites();

  return jsonOk({ game: serializeScoredGame(result.game) });
}
