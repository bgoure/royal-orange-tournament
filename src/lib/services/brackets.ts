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
          homeTeam: true,
          awayTeam: true,
          field: { include: { location: { select: { name: true } } } },
          bracketRound: true,
        },
      },
    },
  });
}
