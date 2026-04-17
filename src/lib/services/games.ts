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

/** Next N not-yet-finished games for the home page (by game number like schedule, excludes final/cancelled). */
const UPCOMING_HOME_MAX = 7;

export type GameListFilters = {
  day?: string;
  teamId?: string;
  fieldId?: string;
  /** Division tab id, or `all` / omitted for every division (+ bracket games with no pool). */
  divisionId?: string;
};

function compareGameNumberStrings(a: string, b: string): number {
  const aAllDigits = /^\d+$/.test(a);
  const bAllDigits = /^\d+$/.test(b);
  if (aAllDigits && bAllDigits) return Number(a) - Number(b);
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Schedule default order: by admin game number, then time. Unnumbered games follow numbered ones. */
function sortGamesForScheduleList<T extends { gameNumber: string | null; scheduledAt: Date }>(games: T[]): T[] {
  return [...games].sort((a, b) => {
    const na = a.gameNumber?.trim() ?? "";
    const nb = b.gameNumber?.trim() ?? "";
    const aHas = na.length > 0;
    const bHas = nb.length > 0;
    if (aHas && bHas) {
      const c = compareGameNumberStrings(na, nb);
      if (c !== 0) return c;
    } else if (aHas && !bHas) return -1;
    else if (!aHas && bHas) return 1;
    return a.scheduledAt.getTime() - b.scheduledAt.getTime();
  });
}

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

  const rows = await prisma.game.findMany({
    where: { AND: conditions },
    orderBy: { scheduledAt: "asc" },
    include: gameListInclude,
  });
  return sortGamesForScheduleList(rows);
}

/** Finished pool/bracket games for the public Results page (same filters as schedule, FINAL only). */
export async function listFinalGamesForTournament(tournamentId: string, filters: GameListFilters = {}) {
  const conditions: Prisma.GameWhereInput[] = [{ tournamentId }, { status: GameStatus.FINAL }];

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

  const rows = await prisma.game.findMany({
    where: { AND: conditions },
    orderBy: { scheduledAt: "asc" },
    include: gameListInclude,
  });
  return sortGamesForScheduleList(rows);
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
  const rows = await prisma.game.findMany({
    where: {
      tournamentId,
      status: { notIn: [GameStatus.FINAL, GameStatus.CANCELLED] },
      OR: [{ scheduledAt: { gte: now } }, { status: GameStatus.LIVE }],
    },
    orderBy: { scheduledAt: "asc" },
    include: gameListInclude,
  });
  const sorted = sortGamesForScheduleList(rows);
  return sorted.slice(0, UPCOMING_HOME_MAX);
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
