import { prisma } from "@/lib/db";

export function getTournamentStructure(tournamentId: string) {
  return prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      fields: {
        orderBy: { sortOrder: "asc" },
        include: { location: { select: { id: true, name: true } } },
      },
      divisions: {
        orderBy: { sortOrder: "asc" },
        include: {
          pools: {
            orderBy: { sortOrder: "asc" },
            include: {
              teams: { orderBy: { name: "asc" } },
            },
          },
        },
      },
    },
  });
}

export function getTeamsAdminList(tournamentId: string) {
  return prisma.team.findMany({
    where: { pool: { division: { tournamentId } } },
    include: {
      pool: { include: { division: true } },
    },
    orderBy: { name: "asc" },
  });
}

/** Pools with teams and standings rows for admin standings / tiebreak override UI. */
export function getPoolsForStandingsAdmin(tournamentId: string) {
  return prisma.pool.findMany({
    where: { division: { tournamentId } },
    orderBy: [{ division: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: {
      division: { select: { name: true } },
      teams: { orderBy: { name: "asc" } },
      standings: {
        orderBy: { displayOrder: "asc" },
        include: { team: true },
      },
    },
  });
}

export async function assertDivisionInTournament(divisionId: string, tournamentId: string) {
  const d = await prisma.division.findFirst({
    where: { id: divisionId, tournamentId },
    select: { id: true },
  });
  if (!d) throw new Error("Division not found in this tournament");
}

export async function assertPoolInTournament(poolId: string, tournamentId: string) {
  const p = await prisma.pool.findFirst({
    where: { id: poolId, division: { tournamentId } },
    select: { id: true, divisionId: true },
  });
  if (!p) throw new Error("Pool not found in this tournament");
  return p;
}

export async function assertTeamInTournament(teamId: string, tournamentId: string) {
  const t = await prisma.team.findFirst({
    where: { id: teamId, pool: { division: { tournamentId } } },
    select: { id: true },
  });
  if (!t) throw new Error("Team not found in this tournament");
}
