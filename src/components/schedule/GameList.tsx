import type { Division, Field, Game, Pool } from "@prisma/client";
import { GameKind } from "@prisma/client";
import {
  formatGameScheduledAt,
  formatGameScheduledAtShort,
  formatScheduleDayGroupHeading,
  tournamentCalendarDayKey,
} from "@/lib/datetime-tournament";
import { brandCardGradientClass } from "@/lib/brand-card-gradient";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import { poolCardLabelTextClass } from "@/lib/pool-card-label";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import { AnimatedListItem } from "@/components/ui/AnimatedListItem";
import type { TeamWithPublicLogo } from "@/lib/team-logo";

export type GameWithTeams = Game & {
  field: Field & { location: { name: string } };
  homeTeam: TeamWithPublicLogo | null;
  awayTeam: TeamWithPublicLogo | null;
  pool: (Pool & { division: Division }) | null;
  division?: { id: string; name: string } | null;
};

const statusStyles: Record<string, string> = {
  SCHEDULED: "bg-royal text-white",
  LIVE:
    "bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.7)] motion-safe:animate-pulse motion-reduce:animate-none",
  FINAL: "bg-royal-50 text-royal",
  POSTPONED: "bg-zinc-200 text-zinc-700",
  CANCELLED: "bg-zinc-200 text-zinc-600 line-through",
};

export function isLiveGameToday(g: GameWithTeams, timezone: string): boolean {
  if (g.status !== "LIVE") return false;
  const tz = timezone.trim();
  if (!tz) return false;
  const now = new Date();
  return tournamentCalendarDayKey(g.scheduledAt, tz) === tournamentCalendarDayKey(now, tz);
}

/** Uses admin `gameNumber` when set; otherwise falls back to list position. */
function gameIdDisplayLabel(g: GameWithTeams, fallbackSeq: number): string {
  const n = g.gameNumber?.trim();
  if (n) return `G${n}`;
  return `G${fallbackSeq}`;
}

function GameCardInner({
  g,
  compact,
  liveProminent,
  displayTimeZone,
  fallbackSeq,
  showScores = true,
  scheduleCompactLayout = false,
}: {
  g: GameWithTeams;
  compact?: boolean;
  liveProminent?: boolean;
  displayTimeZone?: string | null;
  fallbackSeq: number;
  showScores?: boolean;
  /** Schedule page: dense two-row card, hide redundant SCHEDULED pill, meta top-right. */
  scheduleCompactLayout?: boolean;
}) {
  const st = statusStyles[g.status] ?? statusStyles.SCHEDULED;
  const hasScore = showScores && g.homeRuns != null && g.awayRuns != null;
  const isLive = g.status === "LIVE";

  const leftBorder = isLive
    ? "border-l-2 border-l-red-500 shadow-[0_0_12px_rgba(239,68,68,0.35)]"
    : "border-l-2 border-l-royal/90";

  const nameSize = liveProminent ? "text-base font-bold md:text-lg" : compact ? "text-xs font-bold" : "text-sm font-bold";
  const scoreNum = liveProminent ? "text-2xl" : compact ? "text-base" : "text-lg";
  const logoSize = compact ? "h-7 w-7 min-h-[28px] min-w-[28px]" : "h-8 w-8 min-h-8 min-w-8";
  const scheduleLogoSize = "h-7 w-7 min-h-[28px] min-w-[28px] shrink-0";

  const cardPadding = scheduleCompactLayout
    ? "px-3 py-2"
    : compact
      ? "min-h-[48px] px-3 py-3"
      : "p-3";
  /** Width is set on horizontal row `<li>` so flex cannot under-size items and clip. */
  const compactShell = compact ? `w-full ${cardPadding}` : cardPadding;
  const surfaceGradient = brandCardGradientClass(g.id);

  const showScheduleStatusPill =
    scheduleCompactLayout && g.status !== "SCHEDULED" && g.status !== "LIVE";
  const showLivePill = scheduleCompactLayout && isLive;

  const metaTopRight = (
    <div className="flex min-w-0 max-w-[min(100%,14rem)] flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-[10px] leading-tight text-zinc-500 sm:max-w-[55%]">
      {showLivePill ? (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st} ${
            liveProminent ? "ring-2 ring-red-400/60" : "ring-2 ring-red-400/50"
          }`}
        >
          LIVE
        </span>
      ) : null}
      {showScheduleStatusPill ? (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st}`}>
          {g.status}
        </span>
      ) : null}
      <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5">
        {g.pool ? (
          <>
            <span className={`font-medium ${poolCardLabelTextClass(g.pool.cardLabelColor)}`}>{g.pool.name}</span>
            <span className="text-zinc-400">·</span>
          </>
        ) : g.gameKind === GameKind.CONSOLATION && g.division ? (
          <>
            <span className="font-medium text-zinc-600">
              {g.division.name} · Friendly consolation
            </span>
            <span className="text-zinc-400">·</span>
          </>
        ) : null}
        <span className="min-w-0 break-words text-right">{g.field.name}</span>
        <span className="text-zinc-400">·</span>
        <span className="inline-block shrink-0 rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
          {gameIdDisplayLabel(g, fallbackSeq)}
        </span>
      </span>
    </div>
  );

  if (scheduleCompactLayout && !hasScore) {
    return (
      <div
        className={`min-w-0 rounded-2xl border border-zinc-200 shadow-[0_1px_3px_rgba(0,0,0,0.1)] ${surfaceGradient} ${leftBorder} ${cardPadding}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-zinc-900">
            {formatGameScheduledAt(g.scheduledAt, displayTimeZone)}
          </p>
          {metaTopRight}
        </div>

        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <TeamLogoMark team={g.awayTeam} sizeClass={scheduleLogoSize} />
            <span className="min-w-0 flex-1 line-clamp-2 break-words text-sm font-bold leading-[1.15] text-zinc-900">
              {g.awayTeam?.name ?? "TBD"}
            </span>
          </div>
          <span className="shrink-0 self-center text-sm font-normal text-accent">vs</span>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">
            <span className="min-w-0 flex-1 line-clamp-2 break-words text-sm font-bold leading-[1.15] text-zinc-900">
              {g.homeTeam?.name ?? "TBD"}
            </span>
            <TeamLogoMark team={g.homeTeam} sizeClass={scheduleLogoSize} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-w-0 rounded-2xl border border-zinc-200 shadow-[0_1px_3px_rgba(0,0,0,0.1)] ${surfaceGradient} ${leftBorder} ${compactShell}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold leading-snug text-zinc-900">
          {compact
            ? formatGameScheduledAtShort(g.scheduledAt, displayTimeZone)
            : formatGameScheduledAt(g.scheduledAt, displayTimeZone)}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st} ${
            isLive && liveProminent ? "ring-2 ring-red-400/60" : isLive ? "ring-2 ring-red-400/50" : ""
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
              <p className={`min-w-0 truncate leading-snug text-zinc-900 ${nameSize}`}>
                {g.awayTeam?.name ?? "TBD"}
              </p>
            </div>
            <span className={`shrink-0 font-bold tabular-nums text-zinc-900 ${scoreNum}`}>{g.awayRuns}</span>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogoMark team={g.homeTeam} sizeClass={logoSize} />
              <p className={`min-w-0 truncate leading-snug text-zinc-900 ${nameSize}`}>
                {g.homeTeam?.name ?? "TBD"}
              </p>
            </div>
            <span className={`shrink-0 font-bold tabular-nums text-zinc-900 ${scoreNum}`}>{g.homeRuns}</span>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 min-w-0 space-y-0.5">
          <p className={`flex min-w-0 items-center gap-2 leading-snug text-zinc-900 ${nameSize}`}>
            <TeamLogoMark team={g.awayTeam} sizeClass={logoSize} />
            <span className="min-w-0 truncate">{g.awayTeam?.name ?? "TBD"}</span>
            <span className="shrink-0 font-normal text-accent">vs</span>
          </p>
          <p className={`flex min-w-0 items-center gap-2 truncate leading-snug text-zinc-900 ${nameSize}`}>
            <TeamLogoMark team={g.homeTeam} sizeClass={logoSize} />
            <span className="truncate">{g.homeTeam?.name ?? "TBD"}</span>
          </p>
        </div>
      )}

      <p className="mt-2 text-[10px] leading-tight text-zinc-500">
        {g.pool ? (
          <>
            <span className={`font-medium ${poolCardLabelTextClass(g.pool.cardLabelColor)}`}>{g.pool.name}</span>
            <span className="mx-1.5 text-zinc-400">·</span>
          </>
        ) : g.gameKind === GameKind.CONSOLATION && g.division ? (
          <>
            <span className="font-medium">
              {g.division.name} · Friendly consolation
            </span>
            <span className="mx-1.5 text-zinc-400">·</span>
          </>
        ) : null}
        {g.field.name}
        <span className="mx-1.5 text-zinc-400">·</span>
        <span className="inline-block rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
          {gameIdDisplayLabel(g, fallbackSeq)}
        </span>
      </p>
    </div>
  );
}

/** Horizontal scroller: explicit item width so cards never flex-shrink into each other. */
const horizontalRowItemClass =
  "flex-none shrink-0 snap-start w-[min(200px,calc(100vw-2rem))] max-[374px]:w-[min(180px,calc(100vw-2.5rem))]";

function GameCard(
  props: Parameters<typeof GameCardInner>[0] & { horizontalRow?: boolean },
) {
  const { horizontalRow, ...inner } = props;
  return (
    <li className={horizontalRow ? horizontalRowItemClass : "min-w-0"}>
      <GameCardInner {...inner} />
    </li>
  );
}

function HorizontalGameRow({
  rows,
  liveProminent,
  displayTimeZone,
  showScores = true,
  animateStagger,
  staggerOffset = 0,
  scheduleCompactLayout = false,
}: {
  rows: { g: GameWithTeams; fallbackSeq: number }[];
  liveProminent?: boolean;
  displayTimeZone?: string | null;
  showScores?: boolean;
  animateStagger?: boolean;
  staggerOffset?: number;
  scheduleCompactLayout?: boolean;
}) {
  return (
    <ul
      {...{ [DIVISION_SWIPE_IGNORE]: "" }}
      className="-mx-4 flex flex-nowrap snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:thin]"
    >
      {rows.map(({ g, fallbackSeq }, i) =>
        animateStagger ? (
          <AnimatedListItem key={g.id} index={staggerOffset + i} className={horizontalRowItemClass}>
            <GameCardInner
              g={g}
              compact
              liveProminent={liveProminent}
              displayTimeZone={displayTimeZone}
              fallbackSeq={fallbackSeq}
              showScores={showScores}
              scheduleCompactLayout={scheduleCompactLayout}
            />
          </AnimatedListItem>
        ) : (
          <GameCard
            key={g.id}
            horizontalRow
            g={g}
            compact
            liveProminent={liveProminent}
            displayTimeZone={displayTimeZone}
            fallbackSeq={fallbackSeq}
            showScores={showScores}
            scheduleCompactLayout={scheduleCompactLayout}
          />
        ),
      )}
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
  animateStagger = false,
  scheduleCompactLayout = false,
}: {
  games: GameWithTeams[];
  timezone?: string;
  emptyMessage?: string;
  emptyHint?: string;
  horizontal?: boolean;
  showScores?: boolean;
  animateStagger?: boolean;
  scheduleCompactLayout?: boolean;
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
      <div className="sticky top-0 z-20 -mx-1 mb-4 border-b border-accent-200 bg-accent-50/95 px-1 pb-3 pt-1 backdrop-blur-sm md:static md:z-0 md:mb-4 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white motion-safe:animate-pulse motion-reduce:animate-none">
            Live today
          </span>
          <span className="text-xs font-medium text-accent-800">Happening now</span>
        </div>
        {horizontal ? (
          <HorizontalGameRow
            rows={liveToday}
            liveProminent
            displayTimeZone={timezone}
            showScores={showScores}
            animateStagger={animateStagger}
            staggerOffset={0}
            scheduleCompactLayout={scheduleCompactLayout}
          />
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
                scheduleCompactLayout={scheduleCompactLayout}
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
          <HorizontalGameRow
            rows={rest}
            displayTimeZone={timezone}
            showScores={showScores}
            animateStagger={animateStagger}
            staggerOffset={liveToday.length}
            scheduleCompactLayout={scheduleCompactLayout}
          />
        ) : null}
      </div>
    );
  }

  const tz = timezone?.trim() ?? "";

  const restByCalendarDay = (() => {
    if (!tz || rest.length === 0) return null;
    const map = new Map<string, typeof rest>();
    for (const row of rest) {
      const key = tournamentCalendarDayKey(row.g.scheduledAt, tz);
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  })();

  const restGrouped =
    restByCalendarDay?.map(([dayKey, rows]) => (
      <section key={dayKey} className="flex flex-col gap-2">
        <h2 className="sticky top-[4.75rem] z-30 -mx-1 border-b border-zinc-200/90 bg-white/90 px-1 py-2 text-sm font-bold text-zinc-900 backdrop-blur-md md:top-[5rem]">
          {formatScheduleDayGroupHeading(rows[0]!.g.scheduledAt, tz)}
        </h2>
        <ul className="flex flex-col gap-2">
          {rows.map(({ g, fallbackSeq }) => (
            <GameCard
              key={g.id}
              g={g}
              displayTimeZone={timezone}
              fallbackSeq={fallbackSeq}
              showScores={showScores}
              scheduleCompactLayout={scheduleCompactLayout}
            />
          ))}
        </ul>
      </section>
    )) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {liveBlock}
      {rest.length > 0 ? (
        restGrouped ? (
          <div className="flex flex-col gap-6">{restGrouped}</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rest.map(({ g, fallbackSeq }) => (
              <GameCard
                key={g.id}
                g={g}
                displayTimeZone={timezone}
                fallbackSeq={fallbackSeq}
                showScores={showScores}
                scheduleCompactLayout={scheduleCompactLayout}
              />
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
