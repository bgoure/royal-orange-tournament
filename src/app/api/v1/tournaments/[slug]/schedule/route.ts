import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api/v1/auth";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const t = await prisma.tournament.findFirst({
    where: { slug, isPublished: true },
    select: { id: true },
  });
  if (!t) return jsonError("Tournament not found", 404);

  const games = await prisma.game.findMany({
    where: { tournamentId: t.id },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      gameKind: true,
      homeRuns: true,
      awayRuns: true,
      schedulePlaceholder: true,
      field: { select: { id: true, name: true } },
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      pool: { select: { id: true, name: true } },
    },
  });

  return jsonOk({ games });
}
