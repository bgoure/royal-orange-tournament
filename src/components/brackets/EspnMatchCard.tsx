"use client";

import type { KeyboardEvent } from "react";
import { formatBracketGameTimeOnly } from "@/lib/datetime-tournament";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import type { GameRow } from "@/components/brackets/bracket-types";
import { getBracketSlotSources } from "@/lib/brackets/game-slot-sources";
import { BRACKET_TEAM_NAME_CLASS } from "@/components/brackets/bracket-card-layout";
import { slotLines, slotLineTextClass } from "@/components/brackets/bracket-slot-lines";
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

function gameIdLabel(game: GameRow, listIndex: number): string {
  const n = game.gameNumber?.trim();
  if (!n) return `G${listIndex + 1}`;
  if (/bye/i.test(n)) return n;
  if (/^G/i.test(n)) return n;
  return `G${n}`;
}

/**
 * Compact ESPN-style matchup: two stacked team rows with optional score,
 * seed/placeholder text, and a thin divider — designed for tree connectors.
 */
export function EspnMatchCard({
  game,
  roundIndexDb,
  matchIndex,
  prevRoundName,
  timeZone,
  showHomeAway = true,
}: {
  game: GameRow;
  roundIndexDb: number;
  matchIndex: number;
  prevRoundName: string | null;
  timeZone?: string | null;
  showHomeAway?: boolean;
}) {
  const bm = game.bracketMatch;
  const bracketMatchIndex = bm?.matchIndex ?? matchIndex;
  const src = getBracketSlotSources(game);
  const away = slotLines(
    game.awayTeam,
    src.awayPool,
    src.awayRank,
    roundIndexDb,
    bracketMatchIndex,
    "away",
    prevRoundName,
    bm?.awayIsBye ?? false,
    bm ? { from: bm.awayFromMatch, kind: bm.awayFromKind } : null,
  );
  const home = slotLines(
    game.homeTeam,
    src.homePool,
    src.homeRank,
    roundIndexDb,
    bracketMatchIndex,
    "home",
    prevRoundName,
    bm?.homeIsBye ?? false,
    bm ? { from: bm.homeFromMatch, kind: bm.homeFromKind } : null,
  );

  const display = useBracketDisplayPrefs();
  const quickEdit = usePublicQuickGameEdit();
  const quickOpen = quickEdit?.enabled
    ? () => quickEdit.open(gameRowToQuickPayload(game))
    : undefined;

  const final = game.status === "FINAL" && game.homeRuns != null && game.awayRuns != null;
  const awayWon = final && game.awayRuns! > game.homeRuns!;
  const homeWon = final && game.homeRuns! > game.awayRuns!;
  const live = game.status === "LIVE";
  const timeOnly = formatBracketGameTimeOnly(game.scheduledAt, timeZone, game.schedulePlaceholder);
  const gLabel = gameIdLabel(game, matchIndex);

  const shell =
    quickOpen != null
      ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-1"
      : "";

  return (
    <article
      className={`w-full overflow-hidden rounded-md border border-zinc-300/90 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-900 ${
        live ? "ring-2 ring-red-400/60" : ""
      } ${shell}`}
      aria-label={`Bracket match ${matchIndex + 1}`}
      role={quickOpen ? "button" : undefined}
      tabIndex={quickOpen ? 0 : undefined}
      onClick={quickOpen}
      onKeyDown={
        quickOpen
          ? (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                quickOpen();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-2 py-0.5 dark:border-zinc-700 dark:bg-zinc-800/80">
        {display.showGameNumber ? (
          <span className="text-[10px] font-bold tabular-nums text-accent">{gLabel}</span>
        ) : (
          <span />
        )}
        {live ? (
          <span className="text-[9px] font-bold uppercase tracking-wide text-red-600">Live</span>
        ) : !final && display.showDateTime ? (
          <span className="truncate text-[10px] font-medium tabular-nums text-zinc-500">
            {timeOnly}
          </span>
        ) : (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
            {final ? "Final" : game.status === "SCHEDULED" ? "" : game.status}
          </span>
        )}
      </div>

      <TeamRow
        line={away}
        score={final ? game.awayRuns : null}
        won={awayWon}
        lost={final && !awayWon}
        showNames={display.showTeamNames}
        ah={showHomeAway ? "A" : null}
      />
      <div className="h-px bg-zinc-200 dark:bg-zinc-700" />
      <TeamRow
        line={home}
        score={final ? game.homeRuns : null}
        won={homeWon}
        lost={final && !homeWon}
        showNames={display.showTeamNames}
        ah={showHomeAway ? "H" : null}
      />
    </article>
  );
}

function TeamRow({
  line,
  score,
  won,
  lost,
  showNames,
  ah,
}: {
  line: ReturnType<typeof slotLines>;
  score: number | null;
  won: boolean;
  lost: boolean;
  showNames: boolean;
  ah: "A" | "H" | null;
}) {
  const nameClass = lost
    ? "text-zinc-400 dark:text-zinc-500"
    : won
      ? "font-bold text-zinc-950 dark:text-white"
      : slotLineTextClass(line);

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 ${
        won ? "bg-royal-50/80 dark:bg-royal-900/30" : ""
      }`}
    >
      <TeamLogoMark team={line.team} sizeClass="h-5 w-5 min-h-[20px] min-w-[20px] shrink-0" />
      {showNames ? (
        <p
          data-bracket-team-name
          className={`min-w-0 flex-1 truncate text-[12px] leading-tight ${BRACKET_TEAM_NAME_CLASS} ${nameClass}`}
        >
          {line.primary}
          {ah && !line.isPlaceholder ? (
            <span className="ml-0.5 text-[9px] font-medium text-zinc-400">({ah})</span>
          ) : null}
        </p>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      {score != null ? (
        <span
          className={`shrink-0 text-sm tabular-nums ${
            won ? "font-bold text-royal" : lost ? "font-medium text-zinc-400" : "font-semibold text-zinc-800"
          }`}
        >
          {score}
        </span>
      ) : null}
    </div>
  );
}
