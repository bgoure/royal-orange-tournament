import { GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk, resolveApiUser } from "@/lib/api/v1/auth";
import { can } from "@/lib/rbac/permissions";
import { assertGameDivisionScope } from "@/lib/rbac/division-scope";
import { advanceBracketWinnerFromGame } from "@/lib/services/bracket-advance";
import { recomputePoolStandings } from "@/lib/services/standings";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; gameId: string }> },
) {
  const user = await resolveApiUser(req);
  if (!user) return jsonError("Unauthorized", 401);
  if (!can(user.role, "game:update")) return jsonError("Forbidden", 403);

  const { slug, gameId } = await ctx.params;
  const t = await prisma.tournament.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (!t) return jsonError("Tournament not found", 404);

  const scopeErr = await assertGameDivisionScope(user.id, user.role, gameId);
  if (scopeErr) return jsonError(scopeErr, 403);

  const body = (await req.json().catch(() => null)) as {
    homeRuns?: number;
    awayRuns?: number;
    status?: string;
  } | null;
  if (!body || typeof body.homeRuns !== "number" || typeof body.awayRuns !== "number") {
    return jsonError("homeRuns and awayRuns are required numbers", 400);
  }

  const game = await prisma.game.findFirst({
    where: { id: gameId, tournamentId: t.id },
    select: { id: true, poolId: true, bracketId: true },
  });
  if (!game) return jsonError("Game not found", 404);

  const status =
    body.status === "FINAL" || body.status == null ? GameStatus.FINAL : (body.status as GameStatus);

  await prisma.game.update({
    where: { id: game.id },
    data: {
      homeRuns: body.homeRuns,
      awayRuns: body.awayRuns,
      status,
      resultType: "REGULAR",
    },
  });

  if (game.poolId) await recomputePoolStandings(game.poolId);
  if (status === GameStatus.FINAL && game.bracketId) {
    await advanceBracketWinnerFromGame(game.id);
  }
  await revalidatePublishedTournamentSites();

  const updated = await prisma.game.findUnique({
    where: { id: game.id },
    select: {
      id: true,
      status: true,
      homeRuns: true,
      awayRuns: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
  });

  return jsonOk({ game: updated });
}
