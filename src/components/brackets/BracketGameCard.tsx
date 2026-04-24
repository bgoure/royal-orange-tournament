"use client";

import type { KeyboardEvent } from "react";
import { GameKind } from "@prisma/client";
import { formatBracketGameScheduledAt } from "@/lib/datetime-tournament";
import { brandCardGradientClass } from "@/lib/brand-card-gradient";
import { poolCardLabelTextClass } from "@/lib/pool-card-label";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import { GAME_CARD_STATUS_STYLES, publicGameStatusLabel } from "@/components/schedule/GameList";
import type { GameRow } from "@/components/brackets/bracket-types";
import { getBracketSlotSources } from "@/lib/brackets/game-slot-sources";
import { slotLines, slotLineTextClass } from "@/components/brackets/bracket-slot-lines";
import type { QuickEditGamePayload } from "@/components/public-admin/PublicQuickGameProvider";
import { usePublicQuickGameEdit } from "@/components/public-admin/PublicQuickGameProvider";

function gameRowToQuickPayload(game: GameRow): QuickEditGamePayload {
  return {
    id: game.id,
    fieldId: game.fieldId,
    scheduledAt: game.scheduledAt,
    schedulePlaceholder: game.schedulePlaceholder,
    gameKind: game.gameKind,
    status: game.status,
    resultType: game.resultType,
    homeRuns: game.homeRuns,
    awayRuns: game.awayRuns,
    homeDefensiveInnings: game.homeDefensiveInnings,
    awayDefensiveInnings: game.awayDefensiveInnings,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    homeTeamName: game.homeTeam?.name ?? "TBD",
    awayTeamName: game.awayTeam?.name ?? "TBD",
  };
}

function bracketAhTag(which: "A" | "H") {
  return (
    <span className="ml-1 text-[10px] font-medium text-zinc-400 dark:text-zinc-500" aria-hidden>
      ({which})
    </span>
  );
}

const scheduleLogoSize = "h-7 w-7 min-h-[28px] min-w-[28px] shrink-0";
const scoredLogoSize = "h-7 w-7 min-h-[28px] min-w-[28px]";

function bracketGameIdLabel(game: GameRow, listIndexZeroBased: number): string {
  const n = game.gameNumber?.trim();
  if (n) return `G${n}`;
  return `G${listIndexZeroBased + 1}`;
}

export function BracketGameCard({
  game,
  roundIndexDb,
  matchIndex,
  prevRoundName,
  timeZone,
  roundLabel,
  /** When many rounds are flattened into one list, use this for the orange G# chip fallback (otherwise `matchIndex` is used). */
  gLabelFallbackIndexZeroBased,
}: {
  game: GameRow;
  /** BracketRound.roundIndex from DB (not index in UI column list). */
  roundIndexDb: number;
  matchIndex: number;
  prevRoundName: string | null;
  timeZone?: string | null;
  /** Mobile list / consolation: show round name above the time row. Omitted in grid columns (round is the column heading). */
  roundLabel?: string | null;
  gLabelFallbackIndexZeroBased?: number;
}) {
  const bm = game.bracketMatch;
  const bracketMatchIndex = bm?.matchIndex ?? matchIndex;
  const gChipIndex = gLabelFallbackIndexZeroBased ?? matchIndex;
  const src = getBracketSlotSources(game);
  const away = slotLines(
    game.awayTeam,
    src.awayPool,
    src.awayRank,
    roundIndexDb,
    bracketMatchIndex,
    "away",
    prevRoundName,
  );
  const home = slotLines(
    game.homeTeam,
    src.homePool,
    src.homeRank,
    roundIndexDb,
    bracketMatchIndex,
    "home",
    prevRoundName,
  );

  const quickEdit = usePublicQuickGameEdit();
  const quickOpen = quickEdit?.enabled
    ? () => quickEdit.open(gameRowToQuickPayload(game))
    : undefined;
  const quickShell =
    quickEdit?.enabled === true
      ? " cursor-pointer ring-2 ring-amber-400/30 transition-[box-shadow] hover:ring-amber-500/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2"
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

  const st = GAME_CARD_STATUS_STYLES[game.status] ?? GAME_CARD_STATUS_STYLES.SCHEDULED;
  const isLive = game.status === "LIVE";
  const leftBorder = isLive
    ? "border-l-2 border-l-red-500 shadow-[0_0_12px_rgba(239,68,68,0.35)]"
    : "border-l-2 border-l-royal/90";

  const surfaceGradient = `${brandCardGradientClass(game.id)} dark:bg-none dark:bg-zinc-900/85`;
  const cardPadding = "px-3 py-2";

  const showScheduleStatusPill = game.status !== "SCHEDULED" && game.status !== "LIVE";
  const showLivePill = isLive;

  const metaTopRight = (
    <div className="flex min-w-0 max-w-[min(100%,14rem)] flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-[10px] leading-tight text-zinc-500 dark:text-zinc-400 sm:max-w-[55%]">
      {showLivePill ? (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st} ring-2 ring-red-400/50`}
        >
          LIVE
        </span>
      ) : null}
      {showScheduleStatusPill ? (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st}`}>
          {publicGameStatusLabel(game.status)}
        </span>
      ) : null}
      <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5">
        {game.pool ? (
          <>
            <span className={`font-medium ${poolCardLabelTextClass(game.pool.cardLabelColor)}`}>{game.pool.name}</span>
            <span className="text-zinc-400 dark:text-zinc-500">·</span>
          </>
        ) : game.gameKind === GameKind.CONSOLATION && game.division ? (
          <>
            <span className="font-medium text-zinc-600 dark:text-zinc-400">
              {game.division.name} · Consolation Game
            </span>
            <span className="text-zinc-400 dark:text-zinc-500">·</span>
          </>
        ) : null}
        <span className="min-w-0 break-words text-right">{game.field.name}</span>
        <span className="text-zinc-400 dark:text-zinc-500">·</span>
        <span className="inline-block shrink-0 rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
          {bracketGameIdLabel(game, gChipIndex)}
        </span>
      </span>
    </div>
  );

  const timeLine = formatBracketGameScheduledAt(game.scheduledAt, timeZone, game.schedulePlaceholder);

  const hasScore = game.status === "FINAL" && game.homeRuns != null && game.awayRuns != null;

  return (
    <article
      className={`min-w-0 rounded-2xl border border-white/45 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md dark:border-zinc-600/55 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] ${surfaceGradient} ${leftBorder} ${cardPadding}${quickShell}`}
      aria-label={`Bracket match ${gChipIndex + 1}`}
      {...quickInteract}
    >
      {roundLabel ? (
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-royal dark:text-royal-200">{roundLabel}</p>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-zinc-900 dark:text-zinc-100">{timeLine}</p>
        {metaTopRight}
      </div>

      {hasScore ? (
        <div className="mt-1.5 space-y-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogoMark team={away.team} sizeClass={scoredLogoSize} />
              <p
                className={`min-w-0 truncate text-xs font-bold leading-snug text-zinc-900 dark:text-zinc-100 ${slotLineTextClass(away)}`}
              >
                {away.primary}
                {bracketAhTag("A")}
              </p>
            </div>
            <span className="shrink-0 text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{game.awayRuns}</span>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogoMark team={home.team} sizeClass={scoredLogoSize} />
              <p
                className={`min-w-0 truncate text-xs font-bold leading-snug text-zinc-900 dark:text-zinc-100 ${slotLineTextClass(home)}`}
              >
                {home.primary}
                {bracketAhTag("H")}
              </p>
            </div>
            <span className="shrink-0 text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{game.homeRuns}</span>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex min-w-0 items-start gap-1.5 sm:gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-1.5">
            <TeamLogoMark team={away.team} sizeClass={scheduleLogoSize} />
            <div className="min-w-0 flex-1">
              <p
                className={`line-clamp-2 break-words text-sm leading-[1.15] ${slotLineTextClass(away)}`}
              >
                {away.primary}
                {bracketAhTag("A")}
              </p>
              {away.secondary ? <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{away.secondary}</p> : null}
            </div>
          </div>
          <span className="shrink-0 self-center text-sm font-normal text-accent dark:text-accent-light">vs</span>
          <div className="flex min-w-0 flex-1 items-start justify-end gap-1.5">
            <div className="min-w-0 flex-1 text-right">
              <p
                className={`line-clamp-2 break-words text-sm leading-[1.15] ${slotLineTextClass(home)}`}
              >
                {home.primary}
                {bracketAhTag("H")}
              </p>
              {home.secondary ? <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{home.secondary}</p> : null}
            </div>
            <TeamLogoMark team={home.team} sizeClass={scheduleLogoSize} />
          </div>
        </div>
      )}
    </article>
  );
}
