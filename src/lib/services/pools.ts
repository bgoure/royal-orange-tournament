import { prisma } from "@/lib/db";

export function listPoolsWithStandings(tournamentId: string) {
  return prisma.pool.findMany({
    where: { division: { tournamentId } },
    orderBy: [{ division: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: {
      division: true,
      standings: {
        orderBy: { displayOrder: "asc" },
        include: { team: true },
      },
    },
  });
}

export async function listTeamsForTournament(tournamentId: string) {
  return prisma.team.findMany({
    where: { pool: { division: { tournamentId } } },
    orderBy: [{ poolId: "asc" }, { name: "asc" }],
    include: { pool: true },
  });
}

export async function listFieldsForTournament(tournamentId: string) {
  return prisma.field.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
  });
}
