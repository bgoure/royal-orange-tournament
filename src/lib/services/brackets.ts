import { prisma } from "@/lib/db";

export function listBracketsForTournament(tournamentId: string) {
  return prisma.bracket.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    include: {
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
