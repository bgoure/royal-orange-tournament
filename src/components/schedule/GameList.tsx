import type { Division, Field, Game, Pool, Team } from "@prisma/client";
import { formatGameScheduledAt, formatGameScheduledAtShort } from "@/lib/datetime-tournament";
import { formatFieldWithLocation } from "@/lib/field-display";
import { EmptyState } from "@/components/ui/EmptyState";

export type GameWithTeams = Game & {
  field: Field & { location: { name: string } };
  homeTeam: Team | null;
  awayTeam: Team | null;
  pool: (Pool & { division: Division }) | null;
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

function GameCard({
  g,
  compact,
  liveProminent,
  displayTimeZone,
}: {
  g: GameWithTeams;
  compact?: boolean;
  liveProminent?: boolean;
  /** Tournament IANA zone — same wall-clock for SSR and browser. */
  displayTimeZone?: string | null;
}) {
  const st = statusStyles[g.status] ?? statusStyles.SCHEDULED;
  const border = cardBorder[g.status] ?? cardBorder.default;
  const hasScore = g.homeRuns != null && g.awayRuns != null;
  const pulse = g.status === "LIVE" && liveProminent;

  const nameSize = liveProminent ? "text-base md:text-lg" : compact ? "text-[12px]" : "text-[13px]";
  const scoreNum = liveProminent ? "text-2xl" : compact ? "text-base" : "text-lg";

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
            <p className={`min-w-0 truncate font-semibold text-zinc-900 ${nameSize}`}>{g.awayTeam?.name ?? "TBD"}</p>
            <span className={`shrink-0 font-bold tabular-nums text-zinc-900 ${scoreNum}`}>{g.awayRuns}</span>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className={`min-w-0 truncate font-semibold text-zinc-900 ${nameSize}`}>{g.homeTeam?.name ?? "TBD"}</p>
            <span className={`shrink-0 font-bold tabular-nums text-zinc-900 ${scoreNum}`}>{g.homeRuns}</span>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 min-w-0 space-y-0.5">
          <p className={`flex min-w-0 items-baseline gap-1 font-semibold text-zinc-900 ${nameSize}`}>
            <span className="min-w-0 truncate">{g.awayTeam?.name ?? "TBD"}</span>
            <span className="shrink-0 font-normal text-zinc-400">vs</span>
          </p>
          <p className={`truncate font-semibold text-zinc-900 ${nameSize}`}>{g.homeTeam?.name ?? "TBD"}</p>
        </div>
      )}

      <p className="mt-1 text-[10px] leading-tight text-zinc-500">
        {formatFieldWithLocation(g.field.name, g.field.location.name)}
        {g.pool ? ` · ${g.pool.name}` : ""}
      </p>
    </li>
  );
}

function HorizontalGameRow({
  games,
  liveProminent,
  displayTimeZone,
}: {
  games: GameWithTeams[];
  liveProminent?: boolean;
  displayTimeZone?: string | null;
}) {
  return (
    <ul className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 snap-x snap-mandatory">
      {games.map((g) => (
        <GameCard key={g.id} g={g} compact liveProminent={liveProminent} displayTimeZone={displayTimeZone} />
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
}: {
  games: GameWithTeams[];
  timezone?: string;
  emptyMessage?: string;
  emptyHint?: string;
  horizontal?: boolean;
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

  const liveToday =
    timezone != null && timezone !== ""
      ? games.filter((g) => isLiveGameToday(g, timezone))
      : games.filter(
          (g) =>
            g.status === "LIVE" &&
            new Date(g.scheduledAt).toDateString() === new Date().toDateString(),
        );

  const liveIds = new Set(liveToday.map((g) => g.id));
  const rest = games.filter((g) => !liveIds.has(g.id));

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
          <HorizontalGameRow games={liveToday} liveProminent displayTimeZone={timezone} />
        ) : (
          <ul className="flex flex-col gap-2">
            {liveToday.map((g) => (
              <GameCard key={g.id} g={g} liveProminent displayTimeZone={timezone} />
            ))}
          </ul>
        )}
      </div>
    ) : null;

  if (horizontal) {
    return (
      <div className="flex flex-col gap-4">
        {liveBlock}
        {rest.length > 0 ? <HorizontalGameRow games={rest} displayTimeZone={timezone} /> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {liveBlock}
      {rest.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rest.map((g) => (
            <GameCard key={g.id} g={g} displayTimeZone={timezone} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
