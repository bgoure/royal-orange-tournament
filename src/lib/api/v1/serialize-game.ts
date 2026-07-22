import type { GameStatus } from "@prisma/client";

/** Shared shape for schedule / live API game rows. */
export type ApiGameListItem = {
  id: string;
  gameNumber: string | null;
  scheduledAt: string;
  updatedAt: string;
  status: GameStatus;
  field: { id: string; name: string; location: string | null };
  division: { id: string; name: string } | null;
  pool: { id: string; name: string } | null;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  homeRuns: number | null;
  awayRuns: number | null;
};

type GameLike = {
  id: string;
  gameNumber: string | null;
  scheduledAt: Date;
  updatedAt: Date;
  status: GameStatus;
  homeRuns: number | null;
  awayRuns: number | null;
  field: { id: string; name: string; location?: { name: string } | null };
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  pool: { id: string; name: string; division?: { id: string; name: string } | null } | null;
  division: { id: string; name: string } | null;
};

/** Scores: FINAL always; LIVE when runs are stored; otherwise null. */
export function mapGameToApiListItem(g: GameLike): ApiGameListItem {
  const division = g.pool?.division ?? g.division;
  const showScores =
    g.status === "FINAL" ||
    (g.status === "LIVE" && (g.homeRuns != null || g.awayRuns != null));
  return {
    id: g.id,
    gameNumber: g.gameNumber,
    scheduledAt: g.scheduledAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    status: g.status,
    field: {
      id: g.field.id,
      name: g.field.name,
      location: g.field.location?.name ?? null,
    },
    division: division ? { id: division.id, name: division.name } : null,
    pool: g.pool ? { id: g.pool.id, name: g.pool.name } : null,
    homeTeam: g.homeTeam ? { id: g.homeTeam.id, name: g.homeTeam.name } : null,
    awayTeam: g.awayTeam ? { id: g.awayTeam.id, name: g.awayTeam.name } : null,
    homeRuns: showScores ? g.homeRuns : null,
    awayRuns: showScores ? g.awayRuns : null,
  };
}

export function parseSchedulePagination(searchParams: URLSearchParams): {
  page: number;
  limit: number;
} {
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw)
    ? Math.min(200, Math.max(1, Math.floor(limitRaw)))
    : 50;
  return { page, limit };
}

const GAME_STATUSES = new Set<string>([
  "SCHEDULED",
  "LIVE",
  "AWAITING_RESULTS",
  "FINAL",
  "POSTPONED",
  "CANCELLED",
]);

export function parseOptionalGameStatus(raw: string | null): GameStatus | undefined {
  if (!raw) return undefined;
  const u = raw.trim().toUpperCase();
  if (!GAME_STATUSES.has(u)) return undefined;
  return u as GameStatus;
}
