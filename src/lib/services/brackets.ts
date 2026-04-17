import { prisma } from "@/lib/db";

export function listBracketsForTournament(
  tournamentId: string,
  opts?: { publishedOnly?: boolean },
) {
  return prisma.bracket.findMany({
    where: {
      tournamentId,
      ...(opts?.publishedOnly ? { published: true } : {}),
    },
    orderBy: { sortOrder: "asc" },
    include: {
      division: { select: { id: true, name: true } },
      rounds: { orderBy: { roundIndex: "asc" } },
      games: {
        orderBy: [{ bracketRound: { roundIndex: "asc" } }, { bracketPosition: "asc" }],
        include: {
          homeTeam: {
            include: {
              pool: { include: { division: true } },
              logo: { select: { mimeType: true, updatedAt: true } },
            },
          },
          awayTeam: {
            include: {
              pool: { include: { division: true } },
              logo: { select: { mimeType: true, updatedAt: true } },
            },
          },
          field: { include: { location: { select: { name: true } } } },
          bracketRound: true,
          bracketMatch: {
            include: {
              homeSourcePool: { include: { division: true } },
              awaySourcePool: { include: { division: true } },
            },
          },
        },
      },
    },
  });
}
