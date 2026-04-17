import type { Division, Field, Game, Pool } from "@prisma/client";
import { GameKind } from "@prisma/client";
import { formatGameScheduledAt, formatGameScheduledAtShort } from "@/lib/datetime-tournament";
import { formatFieldWithLocation } from "@/lib/field-display";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import type { TeamWithPublicLogo } from "@/lib/team-logo";

export type GameWithTeams = Game & {
  field: Field & { location: { name: string } };
  homeTeam: TeamWithPublicLogo | null;
  awayTeam: TeamWithPublicLogo | null;
  pool: (Pool & { division: Division }) | null;
  division?: { id: string; name: string } | null;
};

const statusStyles: Record<string, string> = {
  SCHEDULED: "bg-zinc-100 text-zinc-700",
  LIVE: "bg-red-600 text-white shadow-sm",
  FINAL: "bg-royal-50 text-royal",
  POSTPONED: "bg-amber-100 text-amber-900",
  CANCELLED: "bg-zinc-200 text-zinc-600 line-through",
};

const cardBorder: Record<string, string> = {
  LIVE: "border-red-300 bg-red-50",
  default: "border-zinc-200 bg-white",
};

function dayKeyInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function isLiveGameToday(g: GameWithTeams, timezone: string): boolean {
  if (g.status !== "LIVE") return false;
  const now = new Date();
  return dayKeyInTz(g.scheduledAt, timezone) === dayKeyInTz(now, timezone);
}

/** Uses admin `gameNumber` when set; otherwise falls back to list position. */
function gameIdDisplayLabel(g: GameWithTeams, fallbackSeq: number): string {
  const n = g.gameNumber?.trim();
  if (n) return `G${n}`;
  return `G${fallbackSeq}`;
}

function GameCard({
  g,
  compact,
  liveProminent,
  displayTimeZone,
  fallbackSeq,
  showScores = true,
}: {
  g: GameWithTeams;
  compact?: boolean;
  liveProminent?: boolean;
  /** Tournament IANA zone — same wall-clock for SSR and browser. */
  displayTimeZone?: string | null;
  /** Used only when `g.gameNumber` is empty (matches list order in this view). */
  fallbackSeq: number;
  /** When false (schedule-only view), never show runs even if recorded. */
  showScores?: boolean;
}) {
  const st = statusStyles[g.status] ?? statusStyles.SCHEDULED;
  const border = cardBorder[g.status] ?? cardBorder.default;
  const hasScore = showScores && g.homeRuns != null && g.awayRuns != null;
  const pulse = g.status === "LIVE" && liveProminent;

  const nameSize = liveProminent ? "text-base md:text-lg" : compact ? "text-[12px]" : "text-[13px]";
  const scoreNum = liveProminent ? "text-2xl" : compact ? "text-base" : "text-lg";
  const logoSize = compact ? "h-6 w-6" : "h-8 w-8";

  return (
    <li
      className={`min-w-0 rounded-2xl border shadow-sm ${border} ${liveProminent ? "border-l-4 border-l-red-500" : ""} ${
        pulse ? "animate-pulse" : ""
      } ${compact ? "w-[200px] shrink-0 px-3 py-2.5" : "px-4 py-3"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          {compact
            ? formatGameScheduledAtShort(g.scheduledAt, displayTimeZone)
            : formatGameScheduledAt(g.scheduledAt, displayTimeZone)}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st} ${
            g.status === "LIVE" && liveProminent ? "ring-2 ring-red-200" : ""
          }`}
        >
          {g.status === "LIVE" ? "LIVE" : g.status}
        </span>
      </div>

      {hasScore ? (
        <div className={`mt-1.5 space-y-1 ${liveProminent ? "text-lg" : ""}`}>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogoMark team={g.awayTeam} sizeClass={logoSize} />
              <p className={`min-w-0 truncate font-semibold leading-snug text-zinc-900 ${nameSize}`}>
                {g.awayTeam?.name ?? "TBD"}
              </p>
            </div>
            <span className={`shrink-0 font-bold tabular-nums text-zinc-900 ${scoreNum}`}>{g.awayRuns}</span>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogoMark team={g.homeTeam} sizeClass={logoSize} />
              <p className={`min-w-0 truncate font-semibold leading-snug text-zinc-900 ${nameSize}`}>
                {g.homeTeam?.name ?? "TBD"}
              </p>
            </div>
            <span className={`shrink-0 font-bold tabular-nums text-zinc-900 ${scoreNum}`}>{g.homeRuns}</span>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 min-w-0 space-y-0.5">
          <p className={`flex min-w-0 items-center gap-2 font-semibold leading-snug text-zinc-900 ${nameSize}`}>
            <TeamLogoMark team={g.awayTeam} sizeClass={logoSize} />
            <span className="min-w-0 truncate">{g.awayTeam?.name ?? "TBD"}</span>
            <span className="shrink-0 font-normal text-zinc-400">vs</span>
          </p>
          <p className={`flex min-w-0 items-center gap-2 truncate font-semibold leading-snug text-zinc-900 ${nameSize}`}>
            <TeamLogoMark team={g.homeTeam} sizeClass={logoSize} />
            <span className="truncate">{g.homeTeam?.name ?? "TBD"}</span>
          </p>
        </div>
      )}

      <p className="mt-1 text-[10px] leading-tight text-zinc-500">
        <span className="font-semibold tabular-nums text-zinc-600">{gameIdDisplayLabel(g, fallbackSeq)}</span>
        <span className="text-zinc-400"> · </span>
        {formatFieldWithLocation(g.field.name, g.field.location.name)}
        {g.pool
          ? ` · ${g.pool.name}`
          : g.gameKind === GameKind.CONSOLATION && g.division
            ? ` · ${g.division.name} · Friendly consolation`
            : ""}
      </p>
    </li>
  );
}

function HorizontalGameRow({
  rows,
  liveProminent,
  displayTimeZone,
  showScores = true,
}: {
  rows: { g: GameWithTeams; fallbackSeq: number }[];
  liveProminent?: boolean;
  displayTimeZone?: string | null;
  showScores?: boolean;
}) {
  return (
    <ul className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 snap-x snap-mandatory">
      {rows.map(({ g, fallbackSeq }) => (
        <GameCard
          key={g.id}
          g={g}
          compact
          liveProminent={liveProminent}
          displayTimeZone={displayTimeZone}
          fallbackSeq={fallbackSeq}
          showScores={showScores}
        />
      ))}
    </ul>
  );
}

export function GameList({
  games,
  timezone,
  emptyMessage = "No games match your filters.",
  emptyHint,
  horizontal,
  showScores = true,
}: {
  games: GameWithTeams[];
  timezone?: string;
  emptyMessage?: string;
  emptyHint?: string;
  horizontal?: boolean;
  /** When false, schedule-style matchup lines only (no runs), regardless of game state. */
  showScores?: boolean;
}) {
  if (games.length === 0) {
    return (
      <EmptyState
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        }
        title={emptyMessage}
        description={emptyHint ?? "Try another day, team, or division filter."}
      />
    );
  }

  const indexedGames = games.map((g, i) => ({ g, fallbackSeq: i + 1 }));

  const liveToday =
    timezone != null && timezone !== ""
      ? indexedGames.filter(({ g }) => isLiveGameToday(g, timezone))
      : indexedGames.filter(
          ({ g }) =>
            g.status === "LIVE" &&
            new Date(g.scheduledAt).toDateString() === new Date().toDateString(),
        );

  const liveIds = new Set(liveToday.map(({ g }) => g.id));
  const rest = indexedGames.filter(({ g }) => !liveIds.has(g.id));

  const liveBlock =
    liveToday.length > 0 ? (
      <div className="sticky top-0 z-20 -mx-1 mb-4 border-b border-red-100 bg-red-50/95 px-1 pb-3 pt-1 backdrop-blur-sm md:static md:z-0 md:mb-4 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Live today
          </span>
          <span className="text-xs text-red-800">Happening now</span>
        </div>
        {horizontal ? (
          <HorizontalGameRow rows={liveToday} liveProminent displayTimeZone={timezone} showScores={showScores} />
        ) : (
          <ul className="flex flex-col gap-2">
            {liveToday.map(({ g, fallbackSeq }) => (
              <GameCard
                key={g.id}
                g={g}
                liveProminent
                displayTimeZone={timezone}
                fallbackSeq={fallbackSeq}
                showScores={showScores}
              />
            ))}
          </ul>
        )}
      </div>
    ) : null;

  if (horizontal) {
    return (
      <div className="flex flex-col gap-4">
        {liveBlock}
        {rest.length > 0 ? (
          <HorizontalGameRow rows={rest} displayTimeZone={timezone} showScores={showScores} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {liveBlock}
      {rest.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rest.map(({ g, fallbackSeq }) => (
            <GameCard
              key={g.id}
              g={g}
              displayTimeZone={timezone}
              fallbackSeq={fallbackSeq}
              showScores={showScores}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
