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

  const pools = await prisma.pool.findMany({
    where: { division: { tournamentId: t.id } },
    orderBy: [{ division: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      division: { select: { id: true, name: true } },
      standings: {
        orderBy: { displayOrder: "asc" },
        select: {
          wins: true,
          losses: true,
          ties: true,
          points: true,
          runsFor: true,
          runsAgainst: true,
          displayOrder: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
  });

  return jsonOk({ pools });
}
