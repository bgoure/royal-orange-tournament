import { GameKind } from "@prisma/client";
import { prisma } from "@/lib/db";

export function listConsolationGamesForAdmin(tournamentId: string) {
  return prisma.game.findMany({
    where: { tournamentId, gameKind: GameKind.CONSOLATION },
    orderBy: { scheduledAt: "asc" },
    include: {
      division: { select: { id: true, name: true } },
      field: { include: { location: { select: { name: true } } } },
      consolationHomePool: { select: { id: true, name: true } },
      consolationAwayPool: { select: { id: true, name: true } },
    },
  });
}

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
      published: true,
      needsResolutionRefresh: true,
      division: { select: { id: true, name: true } },
      _count: { select: { rounds: true, games: true } },
    },
  });
}

/** Divisions with pools (team counts) for the playoff wizard; includes whether a bracket already exists. */
export function listDivisionsForPlayoffWizard(tournamentId: string) {
  return prisma.division.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    include: {
      pools: {
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { teams: true } },
        },
      },
      _count: { select: { brackets: true } },
    },
  });
}
