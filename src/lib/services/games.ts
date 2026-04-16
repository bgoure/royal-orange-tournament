import type { Prisma } from "@prisma/client";
import { GameStatus } from "@prisma/client";
import { divisionTabGameWhere } from "@/lib/division-tabs";
import { prisma } from "@/lib/db";

const gameListInclude = {
  field: { include: { location: { select: { name: true } } } },
  homeTeam: true,
  awayTeam: true,
  pool: { include: { division: true } },
  bracketRound: true,
} as const;

/** Next N not-yet-finished games for the home page (chronological, excludes final/cancelled). */
const UPCOMING_HOME_MAX = 7;

export type GameListFilters = {
  day?: string;
  teamId?: string;
  fieldId?: string;
  /** Division tab id, or `all` / omitted for every division (+ bracket games with no pool). */
  divisionId?: string;
};

export async function listGamesForTournament(tournamentId: string, filters: GameListFilters = {}) {
  const conditions: Prisma.GameWhereInput[] = [{ tournamentId }];

  if (filters.teamId) {
    conditions.push({
      OR: [{ homeTeamId: filters.teamId }, { awayTeamId: filters.teamId }],
    });
  }
  if (filters.fieldId) {
    conditions.push({ fieldId: filters.fieldId });
  }
  if (filters.day) {
    const start = new Date(filters.day);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      conditions.push({ scheduledAt: { gte: start, lt: end } });
    }
  }
  const divW = divisionTabGameWhere(filters.divisionId);
  if (divW) conditions.push(divW);

  return prisma.game.findMany({
    where: { AND: conditions },
    orderBy: { scheduledAt: "asc" },
    include: gameListInclude,
  });
}

/** Distinct days / teams / fields from games matching the division tab (same filter as listGames). */
export async function listScheduleFilterFacets(
  tournamentId: string,
  divisionId: string | undefined,
  timezone: string,
): Promise<{
  dayOptions: { value: string; label: string }[];
  teamIds: Set<string>;
  fieldIds: Set<string>;
}> {
  const conditions: Prisma.GameWhereInput[] = [{ tournamentId }];
  const divW = divisionTabGameWhere(divisionId);
  if (divW) conditions.push(divW);

  const rows = await prisma.game.findMany({
    where: { AND: conditions },
    select: {
      scheduledAt: true,
      homeTeamId: true,
      awayTeamId: true,
      fieldId: true,
    },
  });

  const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayLabelFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const dayKeyToSample = new Map<string, Date>();
  const teamIds = new Set<string>();
  const fieldIds = new Set<string>();

  for (const r of rows) {
    const key = dayKeyFmt.format(r.scheduledAt);
    if (!dayKeyToSample.has(key)) dayKeyToSample.set(key, r.scheduledAt);
    if (r.homeTeamId) teamIds.add(r.homeTeamId);
    if (r.awayTeamId) teamIds.add(r.awayTeamId);
    fieldIds.add(r.fieldId);
  }

  const dayOptions = [...dayKeyToSample.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, sample]) => ({
      value,
      label: dayLabelFmt.format(sample),
    }));

  return { dayOptions, teamIds, fieldIds };
}

export async function listUpcomingGamesForHome(tournamentId: string) {
  const now = new Date();
  return prisma.game.findMany({
    where: {
      tournamentId,
      status: { notIn: [GameStatus.FINAL, GameStatus.CANCELLED] },
      OR: [{ scheduledAt: { gte: now } }, { status: GameStatus.LIVE }],
    },
    orderBy: { scheduledAt: "asc" },
    take: UPCOMING_HOME_MAX,
    include: gameListInclude,
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
