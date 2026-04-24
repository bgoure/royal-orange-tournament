"use client";

import type { BracketRound, Division, Field, Game, Pool } from "@prisma/client";
import type { KeyboardEvent } from "react";
import { GameKind } from "@prisma/client";
import {
  formatGameScheduledAt,
  formatGameScheduledAtShort,
  formatScheduleDayGroupHeading,
  tournamentCalendarDayKey,
} from "@/lib/datetime-tournament";
import { playoffScheduleBracketCaption } from "@/lib/brackets/bracket-display";
import { brandCardGradientClass } from "@/lib/brand-card-gradient";
import { publicGlassCardOverlay2xl } from "@/lib/public-glass-card";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import { gameDivisionIdForFavorites } from "@/lib/game-division-from-game";
import { poolCardLabelTextClass } from "@/lib/pool-card-label";
import { EmptyState } from "@/components/ui/EmptyState";
import { FavoriteTeamButton } from "@/components/ui/FavoriteTeamButton";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import { AnimatedListItem } from "@/components/ui/AnimatedListItem";
import type { QuickEditGamePayload } from "@/components/public-admin/PublicQuickGameProvider";
import { usePublicQuickGameEdit } from "@/components/public-admin/PublicQuickGameProvider";
import type { TeamWithPublicLogo } from "@/lib/team-logo";

/** Public-facing status pill label (enum-safe for new Prisma values). */
export function publicGameStatusLabel(status: string): string {
  switch (status) {
    case "LIVE":
      return "LIVE";
    case "AWAITING_RESULTS":
      return "Awaiting results";
    case "SCHEDULED":
      return "Scheduled";
    case "FINAL":
      return "Final";
    case "POSTPONED":
      return "Postponed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}

function formatInningsCountForBadge(n: number): string {
  const t = Math.round(n * 10) / 10;
  if (Number.isInteger(t)) return String(t);
  return t.toFixed(1).replace(/\.0$/, "");
}

/** Status text for game card pills; results list can show FINAL + home defensive innings. */
export function gameCardStatusPillText(
  g: GameWithTeams,
  opts?: { showScores?: boolean; resultsFinalInnings?: boolean },
): string {
  const showScores = opts?.showScores !== false;
  const hasScore = showScores && g.homeRuns != null && g.awayRuns != null;
  if (
    opts?.resultsFinalInnings &&
    g.status === "FINAL" &&
    hasScore &&
    g.homeDefensiveInnings != null
  ) {
    const n = g.homeDefensiveInnings;
    const count = formatInningsCountForBadge(n);
    const inningWord = n === 1 ? "inning" : "innings";
    return `FINAL - ${count} ${inningWord}`;
  }
  return publicGameStatusLabel(g.status);
}

function ahSuffix(which: "A" | "H") {
  return (
    <span className="ml-1 text-[10px] font-medium text-zinc-400 dark:text-zinc-500" aria-hidden>
      ({which})
    </span>
  );
}

function gameWithTeamsToQuickPayload(g: GameWithTeams): QuickEditGamePayload {
  return {
    id: g.id,
    fieldId: g.fieldId,
    scheduledAt: g.scheduledAt,
    schedulePlaceholder: g.schedulePlaceholder,
    gameKind: g.gameKind,
    status: g.status,
    resultType: g.resultType,
    homeRuns: g.homeRuns,
    awayRuns: g.awayRuns,
    homeDefensiveInnings: g.homeDefensiveInnings,
    awayDefensiveInnings: g.awayDefensiveInnings,
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    homeTeamName: g.homeTeam?.name ?? "TBD",
    awayTeamName: g.awayTeam?.name ?? "TBD",
  };
}

export type GameWithTeams = Game & {
  field: Field & { location: { name: string } };
  homeTeam: TeamWithPublicLogo | null;
  awayTeam: TeamWithPublicLogo | null;
  pool: (Pool & { division: Division }) | null;
  division?: { id: string; name: string } | null;
  bracketRound:
    | (BracketRound & {
        bracket: { division: { id: string; name: string } };
      })
    | null;
};

/** Shared with bracket cards so status pills match schedule / results. */
export const GAME_CARD_STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-royal text-white",
  LIVE:
    "bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.7)] motion-safe:animate-pulse motion-reduce:animate-none",
  AWAITING_RESULTS:
    "bg-amber-100 text-amber-950 ring-1 ring-amber-300/80 dark:bg-amber-900/50 dark:text-amber-100 dark:ring-amber-600/50",
  FINAL: "bg-royal-50 text-royal dark:bg-royal-950/80 dark:text-royal-100",
  POSTPONED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  CANCELLED: "bg-zinc-200 text-zinc-600 line-through dark:bg-zinc-700 dark:text-zinc-300",
};

export function isLiveGameToday(g: GameWithTeams, timezone: string): boolean {
  if (g.status !== "LIVE") return false;
  const tz = timezone.trim();
  if (!tz) return false;
  const now = new Date();
  return tournamentCalendarDayKey(g.scheduledAt, tz) === tournamentCalendarDayKey(now, tz);
}

/** Final / cancelled / awaiting results — same “not upcoming” set as home strips; shown last on the schedule page. */
const SCHEDULE_PAGE_COMPLETED_STATUSES = new Set<string>(["FINAL", "CANCELLED", "AWAITING_RESULTS"]);

function isSchedulePageCompletedGame(g: GameWithTeams): boolean {
  return SCHEDULE_PAGE_COMPLETED_STATUSES.has(g.status);
}

function groupIndexedGamesByCalendarDay(
  rows: { g: GameWithTeams; fallbackSeq: number }[],
  tz: string,
) {
  const map = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = tournamentCalendarDayKey(row.g.scheduledAt, tz);
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** Uses admin `gameNumber` when set; otherwise falls back to list position. */
function gameIdDisplayLabel(g: GameWithTeams, fallbackSeq: number): string {
  const n = g.gameNumber?.trim();
  if (n) return `G${n}`;
  return `G${fallbackSeq}`;
}

function bracketCaptionForScheduleCard(g: GameWithTeams): string | null {
  return playoffScheduleBracketCaption({
    gameKind: g.gameKind,
    division: g.division,
    bracketRound: g.bracketRound ?? undefined,
    bracketDivision: g.bracketRound?.bracket?.division,
  });
}

function GameCardInner({
  g,
  compact,
  liveProminent,
  displayTimeZone,
  fallbackSeq,
  showScores = true,
  scheduleCompactLayout = false,
  muted = false,
  resultsFinalInningsBadge = false,
  tournamentId,
  glassVariant = true,
}: {
  g: GameWithTeams;
  compact?: boolean;
  liveProminent?: boolean;
  displayTimeZone?: string | null;
  fallbackSeq: number;
  showScores?: boolean;
  /** Time + game ID top; pool/field bottom-right; status bottom-left when not SCHEDULED. Full-width schedule stays dense; horizontal strips keep compact min-height and two-line team rows. */
  scheduleCompactLayout?: boolean;
  /** Muted palette for finished games at the bottom of the public schedule. */
  muted?: boolean;
  /** Public results: show "FINAL - N innings" from home defensive innings when scored. */
  resultsFinalInningsBadge?: boolean;
  tournamentId?: string;
  glassVariant?: boolean;
}) {
  const quickEdit = usePublicQuickGameEdit();
  const quickOpen = quickEdit?.enabled
    ? () => quickEdit.open(gameWithTeamsToQuickPayload(g))
    : undefined;
  const quickShell =
    quickEdit?.enabled === true
      ? " w-full cursor-pointer text-left ring-2 ring-amber-400/30 transition-[box-shadow] hover:ring-amber-500/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2"
      : "";

  const quickInteract =
    quickOpen != null
      ? {
          role: "button" as const,
          tabIndex: 0,
          onClick: quickOpen,
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              quickOpen();
            }
          },
        }
      : {};

  const st = GAME_CARD_STATUS_STYLES[g.status] ?? GAME_CARD_STATUS_STYLES.SCHEDULED;
  const hasScore = showScores && g.homeRuns != null && g.awayRuns != null;
  const isLive = g.status === "LIVE";
  const statusPillLabel = gameCardStatusPillText(g, { showScores, resultsFinalInnings: resultsFinalInningsBadge });
  const statusPillCase =
    resultsFinalInningsBadge && g.status === "FINAL" && hasScore && g.homeDefensiveInnings != null
      ? "normal-case"
      : "uppercase";

  const leftBorder = isLive
    ? "border-l-2 border-l-red-500 shadow-[0_0_12px_rgba(239,68,68,0.35)]"
    : "border-l-2 border-l-royal/90";
  const leftBorderResolved = muted ? "border-l-2 border-l-zinc-300 dark:border-l-zinc-600" : leftBorder;

  const nameSize = liveProminent ? "text-base font-bold md:text-lg" : compact ? "text-xs font-bold" : "text-sm font-bold";
  const scoreNum = liveProminent ? "text-2xl" : compact ? "text-base" : "text-lg";
  const logoSize = compact ? "h-7 w-7 min-h-[28px] min-w-[28px]" : "h-8 w-8 min-h-8 min-w-8";
  const scheduleLogoSize = "h-7 w-7 min-h-[28px] min-w-[28px] shrink-0";

  /** Full-width schedule list stays dense; horizontal (home upcoming) keeps the original compact card height. */
  const cardPadding =
    scheduleCompactLayout && !compact
      ? "px-3 py-1.5"
      : compact
        ? "min-h-[44px] px-3 py-2"
        : "p-3";
  /** Width is set on horizontal row `<li>` so flex cannot under-size items and clip. */
  const compactShell = compact ? `w-full ${cardPadding}` : cardPadding;
  const surfaceGradient = brandCardGradientClass(g.id);
  const surfaceResolved = muted
    ? "bg-gradient-to-br from-zinc-50 to-zinc-100/85 shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:from-zinc-900 dark:to-zinc-900/90 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
    : `${surfaceGradient} dark:bg-none dark:bg-zinc-900/85`;

  const timeTone = muted ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-900 dark:text-zinc-100";
  const nameTone = muted ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-900 dark:text-zinc-100";
  const scoreTone = muted ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-900 dark:text-zinc-100";
  const metaTone = muted ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400";
  const vsTone = muted ? "text-zinc-400 dark:text-zinc-500" : "text-accent dark:text-accent-light";
  const idBadgeCls = muted
    ? "bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200"
    : "bg-accent text-white";
  const logoTone = muted ? "opacity-80 saturate-[0.65]" : "";

  const divisionIdForFavorite = gameDivisionIdForFavorites(g);

  const scheduleCompactFooterStatus = scheduleCompactLayout && g.status !== "SCHEDULED";

  const bracketCaption = bracketCaptionForScheduleCard(g);

  const scheduleCompactPoolField = (
    <div className={`inline-flex min-w-0 max-w-full flex-wrap items-center justify-end gap-x-1.5 text-[10px] leading-tight ${metaTone}`}>
      {g.pool ? (
        <>
          <span
            className={`font-medium ${muted ? "opacity-80 " : ""}${poolCardLabelTextClass(g.pool.cardLabelColor)}`}
          >
            {g.pool.name}
          </span>
          <span className={muted ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"}>·</span>
        </>
      ) : g.gameKind === GameKind.CONSOLATION && g.division ? (
        <>
          <span
            className={`font-medium ${muted ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-600 dark:text-zinc-400"}`}
          >
            {g.division.name} · Consolation Game
          </span>
          <span className={muted ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"}>·</span>
        </>
      ) : bracketCaption ? (
        <>
          <span className={`font-medium ${muted ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-600 dark:text-zinc-400"}`}>
            {bracketCaption}
          </span>
          <span className={muted ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"}>·</span>
        </>
      ) : null}
      <span className="min-w-0 break-words text-right">{g.field.name}</span>
    </div>
  );

  if (scheduleCompactLayout && !hasScore) {
    const timeLine = compact
      ? formatGameScheduledAtShort(g.scheduledAt, displayTimeZone)
      : formatGameScheduledAt(g.scheduledAt, displayTimeZone);

    const matchupBlock = compact ? (
      <div className="mt-1.5 min-w-0 space-y-0.5">
        <p className={`flex min-w-0 items-center gap-2 leading-snug ${nameTone} ${nameSize}`}>
          <TeamLogoMark team={g.awayTeam} sizeClass={logoSize} className={logoTone} />
          <span className="min-w-0 truncate">
            {g.awayTeam?.name ?? "TBD"}
            {ahSuffix("A")}
          </span>
          {tournamentId && g.awayTeamId ? (
            <FavoriteTeamButton
              tournamentId={tournamentId}
              teamId={g.awayTeamId}
              teamName={g.awayTeam?.name ?? undefined}
              divisionId={divisionIdForFavorite}
            />
          ) : null}
          <span className={`shrink-0 font-normal ${vsTone}`}>vs</span>
        </p>
        <p className={`flex min-w-0 items-center gap-2 truncate leading-snug ${nameTone} ${nameSize}`}>
          <TeamLogoMark team={g.homeTeam} sizeClass={logoSize} className={logoTone} />
          <span className="truncate">
            {g.homeTeam?.name ?? "TBD"}
            {ahSuffix("H")}
          </span>
          {tournamentId && g.homeTeamId ? (
            <FavoriteTeamButton
              tournamentId={tournamentId}
              teamId={g.homeTeamId}
              teamName={g.homeTeam?.name ?? undefined}
              divisionId={divisionIdForFavorite}
            />
          ) : null}
        </p>
      </div>
    ) : (
      <div className="mt-1.5 flex min-w-0 items-center gap-1.5 sm:gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <TeamLogoMark team={g.awayTeam} sizeClass={scheduleLogoSize} className={logoTone} />
          <span className={`min-w-0 flex-1 line-clamp-2 break-words text-sm font-bold leading-[1.15] ${nameTone}`}>
            {g.awayTeam?.name ?? "TBD"}
            {ahSuffix("A")}
          </span>
          {tournamentId && g.awayTeamId ? (
            <FavoriteTeamButton
              tournamentId={tournamentId}
              teamId={g.awayTeamId}
              teamName={g.awayTeam?.name ?? undefined}
              divisionId={divisionIdForFavorite}
            />
          ) : null}
        </div>
        <span className={`shrink-0 self-center text-sm font-normal ${vsTone}`}>vs</span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">
          <span className={`min-w-0 flex-1 line-clamp-2 break-words text-sm font-bold leading-[1.15] ${nameTone}`}>
            {g.homeTeam?.name ?? "TBD"}
            {ahSuffix("H")}
          </span>
          {tournamentId && g.homeTeamId ? (
            <FavoriteTeamButton
              tournamentId={tournamentId}
              teamId={g.homeTeamId}
              teamName={g.homeTeam?.name ?? undefined}
              divisionId={divisionIdForFavorite}
            />
          ) : null}
          <TeamLogoMark team={g.homeTeam} sizeClass={scheduleLogoSize} className={logoTone} />
        </div>
      </div>
    );

    const footerGap = "mt-1";

    const cardShadow = muted ? "shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "shadow-[0_1px_3px_rgba(0,0,0,0.1)]";

    return (
      <div
        className={
          glassVariant
            ? `${publicGlassCardOverlay2xl} ${surfaceResolved} ${leftBorderResolved} ${cardPadding}${quickShell}`
            : `min-w-0 rounded-2xl border border-zinc-200 dark:border-zinc-700 ${cardShadow} ${surfaceResolved} ${leftBorderResolved} ${cardPadding}${quickShell}`
        }
        {...quickInteract}
      >
        <div className="flex items-start justify-between gap-2">
          <p className={`min-w-0 flex-1 text-[10px] font-bold leading-snug ${timeTone}`}>{timeLine}</p>
          <span
            className={`inline-block shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums ${idBadgeCls}`}
          >
            {gameIdDisplayLabel(g, fallbackSeq)}
          </span>
        </div>

        {matchupBlock}

        <div
          className={`${footerGap} flex ${compact ? "min-h-0" : "min-h-0"} items-end justify-between gap-1.5`}
        >
          <div className="min-w-0 shrink-0">
            {scheduleCompactFooterStatus ? (
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${statusPillCase} ${st} ${
                  isLive
                    ? liveProminent
                      ? "ring-2 ring-red-400/60"
                      : "ring-2 ring-red-400/50"
                    : ""
                }`}
              >
                {statusPillLabel}
              </span>
            ) : null}
          </div>
          {scheduleCompactPoolField}
        </div>
      </div>
    );
  }

  const cardShadowMain = muted ? "shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "shadow-[0_1px_3px_rgba(0,0,0,0.1)]";

  return (
    <div
      className={
        glassVariant
          ? `${publicGlassCardOverlay2xl} ${surfaceResolved} ${leftBorderResolved} ${compactShell}${quickShell}`
          : `min-w-0 rounded-2xl border border-zinc-200 dark:border-zinc-700 ${cardShadowMain} ${surfaceResolved} ${leftBorderResolved} ${compactShell}${quickShell}`
      }
      {...quickInteract}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[13px] font-bold leading-snug ${timeTone}`}>
          {compact
            ? formatGameScheduledAtShort(g.scheduledAt, displayTimeZone)
            : formatGameScheduledAt(g.scheduledAt, displayTimeZone)}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusPillCase} ${st} ${
            isLive && liveProminent ? "ring-2 ring-red-400/60" : isLive ? "ring-2 ring-red-400/50" : ""
          }`}
        >
          {statusPillLabel}
        </span>
      </div>

      {hasScore ? (
        <div className={`mt-1.5 space-y-1 ${liveProminent ? "text-lg" : ""}`}>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogoMark team={g.awayTeam} sizeClass={logoSize} className={logoTone} />
              <p className={`min-w-0 truncate leading-snug ${nameTone} ${nameSize}`}>
                {g.awayTeam?.name ?? "TBD"}
                {ahSuffix("A")}
              </p>
              {tournamentId && g.awayTeamId ? (
                <FavoriteTeamButton
                  tournamentId={tournamentId}
                  teamId={g.awayTeamId}
                  teamName={g.awayTeam?.name ?? undefined}
                  divisionId={divisionIdForFavorite}
                />
              ) : null}
            </div>
            <span className={`shrink-0 font-bold tabular-nums ${scoreTone} ${scoreNum}`}>{g.awayRuns}</span>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogoMark team={g.homeTeam} sizeClass={logoSize} className={logoTone} />
              <p className={`min-w-0 truncate leading-snug ${nameTone} ${nameSize}`}>
                {g.homeTeam?.name ?? "TBD"}
                {ahSuffix("H")}
              </p>
              {tournamentId && g.homeTeamId ? (
                <FavoriteTeamButton
                  tournamentId={tournamentId}
                  teamId={g.homeTeamId}
                  teamName={g.homeTeam?.name ?? undefined}
                  divisionId={divisionIdForFavorite}
                />
              ) : null}
            </div>
            <span className={`shrink-0 font-bold tabular-nums ${scoreTone} ${scoreNum}`}>{g.homeRuns}</span>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 min-w-0 space-y-0.5">
          <p className={`flex min-w-0 items-center gap-2 leading-snug ${nameTone} ${nameSize}`}>
            <TeamLogoMark team={g.awayTeam} sizeClass={logoSize} className={logoTone} />
            <span className="min-w-0 truncate">
              {g.awayTeam?.name ?? "TBD"}
              {ahSuffix("A")}
            </span>
            {tournamentId && g.awayTeamId ? (
              <FavoriteTeamButton
                tournamentId={tournamentId}
                teamId={g.awayTeamId}
                teamName={g.awayTeam?.name ?? undefined}
                divisionId={divisionIdForFavorite}
              />
            ) : null}
            <span className={`shrink-0 font-normal ${vsTone}`}>vs</span>
          </p>
          <p className={`flex min-w-0 items-center gap-2 truncate leading-snug ${nameTone} ${nameSize}`}>
            <TeamLogoMark team={g.homeTeam} sizeClass={logoSize} className={logoTone} />
            <span className="truncate">
              {g.homeTeam?.name ?? "TBD"}
              {ahSuffix("H")}
            </span>
            {tournamentId && g.homeTeamId ? (
              <FavoriteTeamButton
                tournamentId={tournamentId}
                teamId={g.homeTeamId}
                teamName={g.homeTeam?.name ?? undefined}
                divisionId={divisionIdForFavorite}
              />
            ) : null}
          </p>
        </div>
      )}

      <p className={`mt-2 text-[10px] leading-tight ${metaTone}`}>
        {g.pool ? (
          <>
            <span className={`font-medium ${muted ? "opacity-80 " : ""}${poolCardLabelTextClass(g.pool.cardLabelColor)}`}>
              {g.pool.name}
            </span>
            <span className={`mx-1.5 ${muted ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"}`}>
              ·
            </span>
          </>
        ) : g.gameKind === GameKind.CONSOLATION && g.division ? (
          <>
            <span className={`font-medium ${muted ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-600 dark:text-zinc-400"}`}>
              {g.division.name} · Consolation Game
            </span>
            <span className={`mx-1.5 ${muted ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"}`}>
              ·
            </span>
          </>
        ) : bracketCaption ? (
          <>
            <span className={`font-medium ${muted ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-600 dark:text-zinc-400"}`}>
              {bracketCaption}
            </span>
            <span className={`mx-1.5 ${muted ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"}`}>
              ·
            </span>
          </>
        ) : null}
        {g.field.name}
        <span className={`mx-1.5 ${muted ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"}`}>·</span>
        <span
          className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums ${idBadgeCls}`}
        >
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
  resultsFinalInningsBadge = false,
  tournamentId,
  glassVariant = true,
}: {
  rows: { g: GameWithTeams; fallbackSeq: number }[];
  liveProminent?: boolean;
  displayTimeZone?: string | null;
  showScores?: boolean;
  animateStagger?: boolean;
  staggerOffset?: number;
  scheduleCompactLayout?: boolean;
  resultsFinalInningsBadge?: boolean;
  tournamentId?: string;
  glassVariant?: boolean;
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
              resultsFinalInningsBadge={resultsFinalInningsBadge}
              tournamentId={tournamentId}
              glassVariant={glassVariant}
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
            resultsFinalInningsBadge={resultsFinalInningsBadge}
            tournamentId={tournamentId}
            glassVariant={glassVariant}
          />
        ),
      )}
    </ul>
  );
}

export function GameList({
  games,
  timezone,
  displayTimesInViewerTimezone = false,
  emptyMessage = "No games match your filters.",
  emptyHint,
  horizontal,
  showScores = true,
  animateStagger = false,
  scheduleCompactLayout = false,
  scheduleDeprioritizeCompleted = false,
  resultsFinalInningsBadge = false,
  tournamentId,
  glassVariant = true,
}: {
  games: GameWithTeams[];
  /** Tournament IANA zone for “Live today” and schedule day grouping. */
  timezone?: string;
  /** When true, game times use the viewer’s local zone (and show a short TZ). */
  displayTimesInViewerTimezone?: boolean;
  emptyMessage?: string;
  emptyHint?: string;
  horizontal?: boolean;
  showScores?: boolean;
  animateStagger?: boolean;
  scheduleCompactLayout?: boolean;
  /**
   * When true (public schedule), finished games (final / cancelled / awaiting results) render after
   * all other games with a muted card treatment. Horizontal lists ignore this.
   */
  scheduleDeprioritizeCompleted?: boolean;
  /** Public results page: status pill shows FINAL + home defensive innings when scored. */
  resultsFinalInningsBadge?: boolean;
  /** Enables favorite-star controls scoped to this tournament. */
  tournamentId?: string;
  /** Glass card treatment (e.g. favorites strip only); omit gradients when true. */
  glassVariant?: boolean;
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

  const formatWallTimeZone = displayTimesInViewerTimezone ? null : (timezone?.trim() || null);

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

  const deprioritizeCompleted = scheduleDeprioritizeCompleted && !horizontal;
  const activeRest = deprioritizeCompleted
    ? rest.filter(({ g }) => !isSchedulePageCompletedGame(g))
    : rest;
  const completedRest = deprioritizeCompleted
    ? rest.filter(({ g }) => isSchedulePageCompletedGame(g))
    : [];

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
            displayTimeZone={formatWallTimeZone}
            showScores={showScores}
            animateStagger={animateStagger}
            staggerOffset={0}
            scheduleCompactLayout={scheduleCompactLayout}
            resultsFinalInningsBadge={resultsFinalInningsBadge}
            tournamentId={tournamentId}
            glassVariant={glassVariant}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {liveToday.map(({ g, fallbackSeq }) => (
              <GameCard
                key={g.id}
                g={g}
                liveProminent
                displayTimeZone={formatWallTimeZone}
                fallbackSeq={fallbackSeq}
                showScores={showScores}
                scheduleCompactLayout={scheduleCompactLayout}
                resultsFinalInningsBadge={resultsFinalInningsBadge}
                tournamentId={tournamentId}
                glassVariant={glassVariant}
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
            displayTimeZone={formatWallTimeZone}
            showScores={showScores}
            animateStagger={animateStagger}
            staggerOffset={liveToday.length}
            scheduleCompactLayout={scheduleCompactLayout}
            resultsFinalInningsBadge={resultsFinalInningsBadge}
            tournamentId={tournamentId}
            glassVariant={glassVariant}
          />
        ) : null}
      </div>
    );
  }

  const tz = timezone?.trim() ?? "";

  const activeByCalendarDay =
    tz && activeRest.length > 0 ? groupIndexedGamesByCalendarDay(activeRest, tz) : null;

  const restGrouped =
    activeByCalendarDay?.map(([dayKey, rows]) => (
      <section key={dayKey} className="flex flex-col gap-2">
        <h2 className="sticky top-[4.75rem] z-30 -mx-1 border-b border-zinc-200/90 bg-white/90 px-1 py-2 text-sm font-bold text-zinc-900 backdrop-blur-md dark:border-zinc-700/90 dark:bg-zinc-950/90 dark:text-zinc-100 md:top-[5rem]">
          {formatScheduleDayGroupHeading(rows[0]!.g.scheduledAt, tz)}
        </h2>
        <ul className="flex flex-col gap-2">
          {rows.map(({ g, fallbackSeq }) => (
            <GameCard
              key={g.id}
              g={g}
              displayTimeZone={formatWallTimeZone}
              fallbackSeq={fallbackSeq}
              showScores={showScores}
              scheduleCompactLayout={scheduleCompactLayout}
              resultsFinalInningsBadge={resultsFinalInningsBadge}
              tournamentId={tournamentId}
              glassVariant={glassVariant}
            />
          ))}
        </ul>
      </section>
    )) ?? null;

  const completedByCalendarDay =
    tz && completedRest.length > 0 ? groupIndexedGamesByCalendarDay(completedRest, tz) : null;

  const completedGrouped =
    completedByCalendarDay?.map(([dayKey, rows]) => (
      <section key={`completed-${dayKey}`} className="flex flex-col gap-2">
        <h3 className="sticky top-[4.75rem] z-30 -mx-1 border-b border-zinc-200/90 bg-white/90 px-1 py-2 text-sm font-bold text-zinc-500 backdrop-blur-md dark:border-zinc-700/90 dark:bg-zinc-950/90 dark:text-zinc-400 md:top-[5rem]">
          {formatScheduleDayGroupHeading(rows[0]!.g.scheduledAt, tz)}
        </h3>
        <ul className="flex flex-col gap-2">
          {rows.map(({ g, fallbackSeq }) => (
            <GameCard
              key={g.id}
              g={g}
              displayTimeZone={formatWallTimeZone}
              fallbackSeq={fallbackSeq}
              showScores={showScores}
              scheduleCompactLayout={scheduleCompactLayout}
              muted={true}
              resultsFinalInningsBadge={resultsFinalInningsBadge}
              tournamentId={tournamentId}
              glassVariant={glassVariant}
            />
          ))}
        </ul>
      </section>
    )) ?? null;

  const completedBlock =
    completedRest.length === 0 ? null : (
      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Completed
        </h2>
        {completedGrouped ? (
          <div className="flex flex-col gap-6">{completedGrouped}</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {completedRest.map(({ g, fallbackSeq }) => (
              <GameCard
                key={g.id}
                g={g}
                displayTimeZone={formatWallTimeZone}
                fallbackSeq={fallbackSeq}
                showScores={showScores}
                scheduleCompactLayout={scheduleCompactLayout}
                muted={true}
                resultsFinalInningsBadge={resultsFinalInningsBadge}
                tournamentId={tournamentId}
                glassVariant={glassVariant}
              />
            ))}
          </ul>
        )}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {liveBlock}
      {activeRest.length > 0 ? (
        restGrouped ? (
          <div className="flex flex-col gap-6">{restGrouped}</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeRest.map(({ g, fallbackSeq }) => (
              <GameCard
                key={g.id}
                g={g}
                displayTimeZone={formatWallTimeZone}
                fallbackSeq={fallbackSeq}
                showScores={showScores}
                scheduleCompactLayout={scheduleCompactLayout}
                resultsFinalInningsBadge={resultsFinalInningsBadge}
                tournamentId={tournamentId}
                glassVariant={glassVariant}
              />
            ))}
          </ul>
        )
      ) : null}
      {completedBlock}
    </div>
  );
}
