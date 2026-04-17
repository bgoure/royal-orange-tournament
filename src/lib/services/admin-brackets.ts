import { prisma } from "@/lib/db";

export function listPoolsAdvancingConfig(tournamentId: string) {
  return prisma.pool.findMany({
    where: { division: { tournamentId } },
    orderBy: [{ division: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: { division: { select: { name: true } } },
  });
}

export function listFieldsForBrackets(tournamentId: string) {
  return prisma.field.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    include: { location: { select: { name: true } } },
  });
}

export function listBracketsSummary(tournamentId: string) {
  return prisma.bracket.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      format: true,
      setupMode: true,
      consolationEnabled: true,
      entryTeamCount: true,
      _count: { select: { rounds: true, games: true } },
    },
  });
}
