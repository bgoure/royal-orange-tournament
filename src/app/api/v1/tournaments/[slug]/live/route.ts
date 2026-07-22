import { GameStatus } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api/v1/auth";
import { mapGameToApiListItem } from "@/lib/api/v1/serialize-game";
import { prisma } from "@/lib/db";
import { listGamesForTournament } from "@/lib/services/games";

/** Lightweight live-games ticker for Expo home tab. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const t = await prisma.tournament.findFirst({
    where: { slug, isPublished: true, archivedAt: null },
    select: { id: true },
  });
  if (!t) return jsonError("Tournament not found", 404);

  const games = await listGamesForTournament(t.id, { status: GameStatus.LIVE });
  return jsonOk({ games: games.map(mapGameToApiListItem) });
}
