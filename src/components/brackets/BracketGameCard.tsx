"use client";

import type { KeyboardEvent } from "react";
import { GameKind } from "@prisma/client";
import { formatBracketGameTimeOnly } from "@/lib/datetime-tournament";
import { brandCardGradientClass } from "@/lib/brand-card-gradient";
import { poolCardLabelTextClass } from "@/lib/pool-card-label";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import { GAME_CARD_STATUS_STYLES, publicGameStatusLabel } from "@/components/schedule/GameList";
import type { GameRow } from "@/components/brackets/bracket-types";
import { getBracketSlotSources } from "@/lib/brackets/game-slot-sources";
import {
  isOba13SitOutGameNumber,
  oba13PlaceholderPrimary,
  OBA13_GAME,
} from "@/lib/services/oba-de-13";
import { BRACKET_TEAM_NAME_CLASS } from "@/components/brackets/bracket-card-layout";
import { slotLines, slotLineTextClass, type SlotLine } from "@/components/brackets/bracket-slot-lines";
import type { QuickEditGamePayload } from "@/components/public-admin/PublicQuickGameProvider";
import { usePublicQuickGameEdit } from "@/components/public-admin/PublicQuickGameProvider";
import { useBracketDisplayPrefs } from "@/components/brackets/BracketViewerPrefs";

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
    gameNumber: game.gameNumber,
  };
}

function bracketAhTag(which: "A" | "H") {
  return (
    <span className="ml-1 text-[10px] font-medium text-zinc-400 dark:text-zinc-500" aria-hidden>
      ({which})
    </span>
  );
}

function maybeBracketAhTag(show: boolean, which: "A" | "H") {
  return show ? bracketAhTag(which) : null;
}

const scheduleLogoSize = "h-8 w-8 min-h-[32px] min-w-[32px] shrink-0";
const scoredLogoSize = "h-8 w-8 min-h-[32px] min-w-[32px]";

function bracketGameIdLabel(game: GameRow, listIndexZeroBased: number): string {
  const n = game.gameNumber?.trim();
  if (!n) return `G${listIndexZeroBased + 1}`;
  if (/bye/i.test(n)) return n;
  if (/^G/i.test(n)) return n;
  return `G${n}`;
}

function isDirectEntryPoolName(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "direct entry";
}

function applyOba13PublicSlot(
  line: SlotLine,
  game: GameRow,
  slot: "home" | "away",
  r5ByeName: string | null | undefined,
): SlotLine {
  if (line.team) return line;
  const fromNum =
    slot === "away"
      ? game.bracketMatch?.awayFromMatch?.game?.gameNumber
      : game.bracketMatch?.homeFromMatch?.game?.gameNumber;
  const copy = oba13PlaceholderPrimary(game.gameNumber, fromNum);
  const withCopy = copy ? { ...line, primary: copy, isPlaceholder: true } : line;

  if (!r5ByeName || (game.gameNumber?.trim() ?? "") !== OBA13_GAME.G23A) return withCopy;
  const bothEmpty = !game.awayTeam && !game.homeTeam;
  if (bothEmpty && slot === "away") {
    return { primary: r5ByeName, secondary: null, team: null, isPlaceholder: false };
  }
  if (!bothEmpty && slot === "away" && !game.awayTeam && game.homeTeam?.name !== r5ByeName) {
    return { primary: r5ByeName, secondary: null, team: null, isPlaceholder: false };
  }
  if (!bothEmpty && slot === "home" && !game.homeTeam && game.awayTeam?.name !== r5ByeName) {
    return { primary: r5ByeName, secondary: null, team: null, isPlaceholder: false };
  }
  return withCopy;
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
  showHomeAway = true,
  minHeight,
  oba13R5ByeName = null,
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
  /** Pool/RR tournaments show (A)/(H); bracket-only events hide them. */
  showHomeAway?: boolean;
  /** Stretch shorter cards so a left-to-right chain shares one midline. */
  minHeight?: number;
  /** Display-only 4-0 name on empty 23A (do not persist). */
  oba13R5ByeName?: string | null;
}) {
  const bm = game.bracketMatch;
  const bracketMatchIndex = bm?.matchIndex ?? matchIndex;
  const gChipIndex = gLabelFallbackIndexZeroBased ?? matchIndex;
  const src = getBracketSlotSources(game);
  const away = applyOba13PublicSlot(
    slotLines(
      game.awayTeam,
      src.awayPool,
      src.awayRank,
      roundIndexDb,
      bracketMatchIndex,
      "away",
      prevRoundName,
      bm?.awayIsBye ?? false,
      bm ? { from: bm.awayFromMatch, kind: bm.awayFromKind } : null,
    ),
    game,
    "away",
    oba13R5ByeName,
  );
  const home = applyOba13PublicSlot(
    slotLines(
      game.homeTeam,
      src.homePool,
      src.homeRank,
      roundIndexDb,
      bracketMatchIndex,
      "home",
      prevRoundName,
      bm?.homeIsBye ?? false,
      bm ? { from: bm.homeFromMatch, kind: bm.homeFromKind } : null,
    ),
    game,
    "home",
    oba13R5ByeName,
  );

  const display = useBracketDisplayPrefs();
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
  const showPoolMeta = game.pool != null && !isDirectEntryPoolName(game.pool.name);
  const gameIdLabel = bracketGameIdLabel(game, gChipIndex);

  const metaRow = (
    <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
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
      {showPoolMeta ? (
        <>
          <span className={`font-medium ${poolCardLabelTextClass(game.pool!.cardLabelColor)}`}>
            {game.pool!.name}
          </span>
          {display.showLocation ? <span className="text-zinc-400 dark:text-zinc-500">·</span> : null}
        </>
      ) : game.gameKind === GameKind.CONSOLATION && game.division ? (
        <>
          <span className="font-medium text-zinc-600 dark:text-zinc-400">
            {game.division.name} · Consolation Game
          </span>
          {display.showLocation ? <span className="text-zinc-400 dark:text-zinc-500">·</span> : null}
        </>
      ) : null}
      {display.showLocation ? (
        <span className="min-w-0 break-words text-center">{game.field.name}</span>
      ) : null}
    </div>
  );

  const timeOnly = formatBracketGameTimeOnly(game.scheduledAt, timeZone, game.schedulePlaceholder);

  const hasScore = game.status === "FINAL" && game.homeRuns != null && game.awayRuns != null;
  const sitOutSlot = isOba13SitOutGameNumber(game.gameNumber);
  const sitOutTeam = sitOutSlot ? (game.homeTeam ?? game.awayTeam) : null;
  const sitOutText = sitOutSlot
    ? sitOutTeam?.name
      ? `${sitOutTeam.name} sits out`
      : "Sit-out unassigned"
    : null;

  const showTimeRow = !hasScore && (display.showGameNumber || display.showDateTime);
  const showLocationMeta =
    !hasScore &&
    (showLivePill ||
      showScheduleStatusPill ||
      showPoolMeta ||
      (game.gameKind === GameKind.CONSOLATION && game.division) ||
      display.showLocation);

  return (
    <article
      className={`w-full rounded-2xl border border-white/45 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md dark:border-zinc-600/55 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] ${surfaceGradient} ${leftBorder} ${cardPadding}${quickShell}`}
      style={minHeight != null ? { minHeight } : undefined}
      aria-label={`Bracket match ${gChipIndex + 1}`}
      {...quickInteract}
    >
      {roundLabel ? (
        <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-royal dark:text-royal-200">
          {roundLabel}
        </p>
      ) : null}

      {hasScore && display.showGameNumber ? (
        <div className="flex items-center justify-center">
          <span className="inline-block rounded-md bg-accent px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
            {gameIdLabel}
          </span>
        </div>
      ) : showTimeRow ? (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          {display.showGameNumber ? (
            <span className="inline-block rounded-md bg-accent px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
              {gameIdLabel}
            </span>
          ) : null}
          {display.showDateTime ? (
            <span className="text-[13px] font-bold leading-none tabular-nums text-zinc-900 dark:text-zinc-100">
              {timeOnly}
            </span>
          ) : null}
        </div>
      ) : null}

      {showLocationMeta ? (
        <div className="mt-1.5 flex flex-col items-center gap-0.5 text-center">{metaRow}</div>
      ) : null}

      {sitOutSlot ? (
        <div className="mt-1.5 flex flex-col items-center gap-1 text-center">
          <TeamLogoMark team={sitOutTeam} sizeClass={scheduleLogoSize} />
          {display.showTeamNames ? (
            <p
              data-bracket-team-name
              className={`text-sm leading-[1.15] ${BRACKET_TEAM_NAME_CLASS} ${
                sitOutTeam ? "font-bold text-zinc-900" : "font-medium italic text-zinc-500"
              }`}
            >
              {sitOutText}
            </p>
          ) : null}
        </div>
      ) : hasScore ? (
        <div className="mt-1.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <TeamLogoMark team={away.team} sizeClass={scoredLogoSize} />
            {display.showTeamNames ? (
              <p
                data-bracket-team-name
                className={`min-w-0 flex-1 text-xs font-bold leading-snug text-zinc-900 dark:text-zinc-100 ${BRACKET_TEAM_NAME_CLASS} ${slotLineTextClass(away)}`}
              >
                {away.primary}
                {!away.isPlaceholder ? maybeBracketAhTag(showHomeAway, "A") : null}
              </p>
            ) : null}
            <span className="shrink-0 self-center text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {game.awayRuns}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TeamLogoMark team={home.team} sizeClass={scoredLogoSize} />
            {display.showTeamNames ? (
              <p
                data-bracket-team-name
                className={`min-w-0 flex-1 text-xs font-bold leading-snug text-zinc-900 dark:text-zinc-100 ${BRACKET_TEAM_NAME_CLASS} ${slotLineTextClass(home)}`}
              >
                {home.primary}
                {!home.isPlaceholder ? maybeBracketAhTag(showHomeAway, "H") : null}
              </p>
            ) : null}
            <span className="shrink-0 self-center text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {game.homeRuns}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-1.5 sm:gap-x-2">
          <div className="flex min-w-0 flex-col items-center gap-1 text-center">
            <TeamLogoMark team={away.team} sizeClass={scheduleLogoSize} />
            {display.showTeamNames ? (
              <div className="min-w-0 w-full">
                <p
                  data-bracket-team-name
                  className={`text-sm leading-[1.15] ${BRACKET_TEAM_NAME_CLASS} ${slotLineTextClass(away)}`}
                >
                  {away.primary}
                  {!away.isPlaceholder ? maybeBracketAhTag(showHomeAway, "A") : null}
                </p>
                {away.secondary ? (
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{away.secondary}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <span className="shrink-0 self-center text-sm font-normal text-accent dark:text-accent-light">vs</span>
          <div className="flex min-w-0 flex-col items-center gap-1 text-center">
            <TeamLogoMark team={home.team} sizeClass={scheduleLogoSize} />
            {display.showTeamNames ? (
              <div className="min-w-0 w-full">
                <p
                  data-bracket-team-name
                  className={`text-sm leading-[1.15] ${BRACKET_TEAM_NAME_CLASS} ${slotLineTextClass(home)}`}
                >
                  {home.primary}
                  {!home.isPlaceholder ? maybeBracketAhTag(showHomeAway, "H") : null}
                </p>
                {home.secondary ? (
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{home.secondary}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}
