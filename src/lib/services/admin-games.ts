import { prisma } from "@/lib/db";
import { teamWithPublicLogoInclude } from "@/lib/team-logo";

export function listGamesAdmin(tournamentId: string) {
  return prisma.game.findMany({
    where: { tournamentId },
    include: {
      homeTeam: teamWithPublicLogoInclude,
      awayTeam: teamWithPublicLogoInclude,
      field: { include: { location: { select: { name: true } } } },
      pool: { include: { division: true } },
      bracket: { select: { id: true } },
      division: { select: { id: true, name: true } },
      consolationHomePool: { select: { id: true, name: true } },
      consolationAwayPool: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });
}

export async function assertGameInTournament(gameId: string, tournamentId: string) {
  const g = await prisma.game.findFirst({
    where: { id: gameId, tournamentId },
    select: { id: true, poolId: true, bracketId: true, gameKind: true },
  });
  if (!g) throw new Error("Game not found in this tournament");
  return g;
}

/** Bracket games: both teams must belong to the tournament (via pool → division). */
export async function assertTeamsInBracketTournament(
  tournamentId: string,
  homeTeamId: string,
  awayTeamId: string,
) {
  if (homeTeamId === awayTeamId) {
    throw new Error("Home and away cannot be the same team");
  }
  const teams = await prisma.team.findMany({
    where: { id: { in: [homeTeamId, awayTeamId] } },
    include: { pool: { include: { division: { select: { tournamentId: true } } } } },
  });
  if (teams.length !== 2) throw new Error("One or both teams not found");
  for (const t of teams) {
    if (t.pool.division.tournamentId !== tournamentId) {
      throw new Error("Both teams must belong to this tournament");
    }
  }
}

export async function assertTeamsInPool(homeTeamId: string, awayTeamId: string, poolId: string) {
  if (homeTeamId === awayTeamId) {
    throw new Error("Home and away cannot be the same team");
  }
  const teams = await prisma.team.findMany({
    where: { id: { in: [homeTeamId, awayTeamId] } },
    select: { id: true, poolId: true },
  });
  if (teams.length !== 2) throw new Error("One or both teams not found");
  for (const t of teams) {
    if (t.poolId !== poolId) {
      throw new Error("Both teams must belong to the selected pool");
    }
  }
}

export async function assertPoolInTournament(poolId: string, tournamentId: string) {
  const p = await prisma.pool.findFirst({
    where: { id: poolId, division: { tournamentId } },
    select: { id: true },
  });
  if (!p) throw new Error("Pool not found in this tournament");
}

export async function assertFieldInTournament(fieldId: string, tournamentId: string) {
  const f = await prisma.field.findFirst({
    where: { id: fieldId, tournamentId },
    include: { location: { select: { tournamentId: true } } },
  });
  if (!f) throw new Error("Field not found in this tournament");
  if (f.location.tournamentId !== tournamentId) {
    throw new Error("Field location must belong to the same tournament");
  }
}
