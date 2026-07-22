import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api/v1/auth";

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

  const brackets = await prisma.bracket.findMany({
    where: { tournamentId: t.id, published: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      format: true,
      division: { select: { id: true, name: true } },
      rounds: {
        orderBy: { roundIndex: "asc" },
        select: {
          id: true,
          name: true,
          roundIndex: true,
          roundType: true,
          matches: {
            orderBy: { matchIndex: "asc" },
            select: {
              matchIndex: true,
              homeIsBye: true,
              awayIsBye: true,
              game: {
                select: {
                  id: true,
                  status: true,
                  homeRuns: true,
                  awayRuns: true,
                  homeTeam: { select: { id: true, name: true } },
                  awayTeam: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return jsonOk({
    brackets: brackets.map((b) => ({
      ...b,
      rounds: b.rounds.map((r) => ({
        ...r,
        matches: r.matches.map((m) => ({
          ...m,
          game: m.game
            ? {
                ...m.game,
                homeRuns: m.game.status === "FINAL" ? m.game.homeRuns : null,
                awayRuns: m.game.status === "FINAL" ? m.game.awayRuns : null,
              }
            : null,
        })),
      })),
    })),
  });
}
