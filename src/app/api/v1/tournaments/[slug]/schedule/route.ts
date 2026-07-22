import { jsonError, jsonOk } from "@/lib/api/v1/auth";
import {
  mapGameToApiListItem,
  parseOptionalGameStatus,
  parseSchedulePagination,
} from "@/lib/api/v1/serialize-game";
import { prisma } from "@/lib/db";
import { listGamesForTournament } from "@/lib/services/games";

/**
 * Public games list. Reuses `listGamesForTournament` (same query the public Schedule page uses),
 * so consolation-game visibility rules (hidden until that division's bracket is published) match
 * the site. Optional query params: `day`, `teamId`, `fieldId`, `division`, `status`, `page`, `limit`.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const t = await prisma.tournament.findFirst({
    where: { slug, isPublished: true, archivedAt: null },
    select: { id: true },
  });
  if (!t) return jsonError("Tournament not found", 404);

  const { searchParams } = new URL(request.url);
  const status = parseOptionalGameStatus(searchParams.get("status"));
  if (searchParams.get("status") && !status) {
    return jsonError("Invalid status filter", 400);
  }
  const { page, limit } = parseSchedulePagination(searchParams);

  const all = await listGamesForTournament(t.id, {
    day: searchParams.get("day") ?? undefined,
    teamId: searchParams.get("teamId") ?? undefined,
    fieldId: searchParams.get("fieldId") ?? undefined,
    divisionId: searchParams.get("division") ?? undefined,
    status,
  });

  const total = all.length;
  const start = (page - 1) * limit;
  const slice = all.slice(start, start + limit);

  return jsonOk({
    games: slice.map(mapGameToApiListItem),
    page,
    limit,
    total,
  });
}
