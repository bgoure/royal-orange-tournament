import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type GameListFilters = {
  day?: string;
  teamId?: string;
  fieldId?: string;
};

export async function listGamesForTournament(tournamentId: string, filters: GameListFilters = {}) {
  const where: Prisma.GameWhereInput = { tournamentId };

  if (filters.teamId) {
    where.OR = [{ homeTeamId: filters.teamId }, { awayTeamId: filters.teamId }];
  }
  if (filters.fieldId) {
    where.fieldId = filters.fieldId;
  }
  if (filters.day) {
    const start = new Date(filters.day);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.scheduledAt = { gte: start, lt: end };
    }
  }

  return prisma.game.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: {
      field: { include: { location: { select: { name: true } } } },
      homeTeam: true,
      awayTeam: true,
      pool: true,
      bracketRound: true,
    },
  });
}

export async function listTodaysGames(tournamentId: string, timezone: string) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return listGamesForTournament(tournamentId, {});

  const dayKey = `${y}-${m}-${d}`;
  return listGamesForTournament(tournamentId, { day: dayKey });
}
