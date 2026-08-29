"use client";

import { useMemo, type ReactNode } from "react";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import type { BracketRound } from "@prisma/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/ui/PublicHeading";
import { BracketExportControls } from "@/components/brackets/BracketExportControls";
import { BracketZoomShell, BRACKET_DESKTOP_WIDE_CLASS, useBracketPhotoExpandAll } from "@/components/brackets/BracketZoomShell";
import { BracketGameCard } from "@/components/brackets/BracketGameCard";
import { BRACKET_ROUND_COLUMN_CLASS } from "@/components/brackets/bracket-card-layout";
import { BidirectionalDeBracket } from "@/components/brackets/BidirectionalDeBracket";
import { ChronologicalRoundBracket } from "@/components/brackets/ChronologicalRoundBracket";
import { ChampionCelebration } from "@/components/brackets/ChampionCelebration";
import { CollapsedRoundStrip } from "@/components/brackets/CollapsedRoundStrip";
import { useRoundFocus } from "@/components/brackets/use-round-focus";
import type { BracketWith, GameRow } from "@/components/brackets/bracket-types";
import { matchSortIndex } from "@/components/brackets/bracket-slot-lines";
import { resolveChampionFromBracket, shouldShowChampionCelebration } from "@/lib/brackets/bracket-champion";
import { isObaDePresetKey } from "@/lib/brackets/oba-de-presets";
import {
  filterRoundsForScope,
  roundTypeShortLabel,
} from "@/lib/brackets/bracket-display";
import { latestScoredColumnIndex } from "@/lib/brackets/bracket-round-window";
import { withBracketRoundDay } from "@/lib/datetime-tournament";

function BracketGrid({
  byRound,
  roundsOrdered,
  timeZone,
  showHomeAway = true,
  fitContent = false,
  expandAll = false,
}: {
  byRound: Map<string, GameRow[]>;
  roundsOrdered: BracketRound[];
  timeZone?: string | null;
  showHomeAway?: boolean;
  /** Size to the full tree (export) instead of scrolling. */
  fitContent?: boolean;
  expandAll?: boolean;
}) {
  const activeIndex = latestScoredColumnIndex(
    roundsOrdered.map((r) => ({ games: byRound.get(r.id) ?? [] })),
  );
  const focus = useRoundFocus(roundsOrdered.length, activeIndex, expandAll || fitContent);

  return (
    <div
      {...{ [DIVISION_SWIPE_IGNORE]: "" }}
      className={`flex gap-3 pb-2 ${
        fitContent ? "w-max overflow-visible" : "mt-4 overflow-x-auto md:overflow-visible"
      }`}
      role="region"
      aria-label="Bracket rounds"
    >
      {roundsOrdered.map((r, ri) => {
        if (!focus.isOpen(ri)) {
          return (
            <CollapsedRoundStrip
              key={r.id}
              label={r.name}
              onExpand={() => focus.toggle(ri)}
            />
          );
        }
        const games = (byRound.get(r.id) ?? []).sort((x, y) => matchSortIndex(x) - matchSortIndex(y));
        const prevRoundName = ri > 0 ? roundsOrdered[ri - 1]!.name : null;
        return (
          <div
            key={r.id}
            className={`${BRACKET_ROUND_COLUMN_CLASS} min-h-[320px] ${ri > 0 ? "border-l border-dashed border-zinc-200 pl-6" : ""}`}
          >
            <div className="mb-3 shrink-0 text-center">
              <h3 className="border-b border-royal/30 pb-1 text-xs font-bold uppercase tracking-[0.06em] text-royal">
                {withBracketRoundDay(r.name, games, timeZone)}
              </h3>
              <p className="mt-1 text-[11px] font-medium text-zinc-600">{roundTypeShortLabel(r.roundType)}</p>
              {!(expandAll || fitContent) ? (
                <button
                  type="button"
                  className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 hover:text-royal"
                  onClick={() => focus.toggle(ri)}
                >
                  Hide
                </button>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col justify-around gap-4">
              {games.length === 0 ? (
                <p className="text-sm text-zinc-500">Matchups TBA.</p>
              ) : (
                games.map((g, mi) => (
                  <BracketGameCard
                    key={g.id}
                    game={g}
                    roundIndexDb={r.roundIndex}
                    matchIndex={mi}
                    prevRoundName={prevRoundName}
                    timeZone={timeZone}
                    showHomeAway={showHomeAway}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BracketDesktopTree({
  b,
  tournamentTimezone,
  showHomeAway = true,
  fitContent = false,
}: {
  b: BracketWith;
  tournamentTimezone?: string | null;
  showHomeAway?: boolean;
  fitContent?: boolean;
}) {
  const photoExpandAll = useBracketPhotoExpandAll();
  const showAllRounds = fitContent || photoExpandAll;
  const roundsSorted = useMemo(
    () => [...b.rounds].sort((a, c) => a.roundIndex - c.roundIndex),
    [b.rounds],
  );
  const isObaChronological = !!b.presetKey && isObaDePresetKey(b.presetKey);
  const visibleRounds = useMemo(
    () => filterRoundsForScope(roundsSorted, "all"),
    [roundsSorted],
  );
  const visibleRoundIds = useMemo(() => new Set(visibleRounds.map((r) => r.id)), [visibleRounds]);
  const gamesInScope = useMemo(
    () =>
      b.games.filter(
        (g) =>
          g.bracketRoundId &&
          visibleRoundIds.has(g.bracketRoundId) &&
          g.status !== "CANCELLED",
      ),
    [b.games, visibleRoundIds],
  );
  const byRound = useMemo(() => {
    const m = new Map<string, GameRow[]>();
    for (const g of gamesInScope) {
      const key = g.bracketRoundId ?? "unassigned";
      const list = m.get(key) ?? [];
      list.push(g);
      m.set(key, list);
    }
    return m;
  }, [gamesInScope]);

  const useChronologicalRounds = isObaChronological;
  const useBidirectional =
    !useChronologicalRounds &&
    (b.format === "DOUBLE_ELIMINATION" || b.format === "TRIPLE_ELIMINATION");

  if (useChronologicalRounds) {
    return (
      <ChronologicalRoundBracket
        rounds={roundsSorted}
        byRound={byRound}
        timeZone={tournamentTimezone}
        format={b.format}
        showHomeAway={showHomeAway}
        presetKey={b.presetKey}
        expandAll={showAllRounds}
      />
    );
  }
  if (useBidirectional) {
    return (
      <BidirectionalDeBracket
        rounds={roundsSorted}
        byRound={byRound}
        timeZone={tournamentTimezone}
        showHomeAway={showHomeAway}
        expandAll={showAllRounds}
        fitContent={showAllRounds}
      />
    );
  }
  return (
    <BracketGrid
      byRound={byRound}
      roundsOrdered={visibleRounds}
      timeZone={tournamentTimezone}
      showHomeAway={showHomeAway}
      fitContent={showAllRounds}
      expandAll={showAllRounds}
    />
  );
}

function BracketSection({
  b,
  tournamentName,
  tournamentTimezone,
  consolationGames,
  showHomeAway = true,
  exportToolbar,
}: {
  b: BracketWith;
  tournamentName: string;
  tournamentTimezone?: string | null;
  consolationGames: GameRow[];
  showHomeAway?: boolean;
  exportToolbar?: () => ReactNode;
}) {
  const champion = useMemo(() => resolveChampionFromBracket(b), [b]);

  return (
    <section className="min-w-0" aria-labelledby={`bracket-heading-${b.id}`}>
      {champion && shouldShowChampionCelebration(champion) ? (
        <ChampionCelebration
          tournamentName={tournamentName}
          divisionName={champion.divisionName}
          winnerTeam={champion.winnerTeam}
          className="mb-4"
          subtitle={(() => {
            if (!champion.isQualifier || !champion.qualifiedTeams) return undefined;
            const others = champion.qualifiedTeams
              .filter((t) => t.id !== champion.winnerTeam.id)
              .map((t) => t.name)
              .filter(Boolean);
            return others.length > 0 ? `Also advancing: ${others.join(" · ")}` : undefined;
          })()}
        />
      ) : null}
      <div className={BRACKET_DESKTOP_WIDE_CLASS}>
      <SectionTitle id={`bracket-heading-${b.id}`} className="normal-case tracking-normal">
        {b.name}
        {b.isQualifier ? (
          <span className="ml-2 text-sm font-normal text-zinc-600">
            (qualifier · top {b.qualifyingTeamCount})
          </span>
        ) : null}
      </SectionTitle>

      <div className="mt-4 hidden md:block">
        <BracketZoomShell toolbarStart={exportToolbar?.()}>
          <BracketDesktopTree
            b={b}
            tournamentTimezone={tournamentTimezone}
            showHomeAway={showHomeAway}
          />
        </BracketZoomShell>
      </div>
      <div className="mt-4 md:hidden">
        <BracketZoomShell toolbarStart={exportToolbar?.()}>
          <BracketDesktopTree
            b={b}
            tournamentTimezone={tournamentTimezone}
            showHomeAway={showHomeAway}
          />
        </BracketZoomShell>
      </div>
      </div>

      <ConsolationGamesSection
        games={consolationGames}
        tournamentTimezone={tournamentTimezone}
        mobileBracketShowsFirstRoundOnly
        showHomeAway={showHomeAway}
      />
    </section>
  );
}

function ConsolationGamesSection({
  games,
  tournamentTimezone,
  mobileBracketShowsFirstRoundOnly,
  showHomeAway = true,
}: {
  games: GameRow[];
  tournamentTimezone?: string | null;
  /** When false, hide this block below `md` while mobile bracket is not on round 1. */
  mobileBracketShowsFirstRoundOnly: boolean;
  showHomeAway?: boolean;
}) {
  if (games.length === 0) return null;
  const sorted = [...games].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return (
    <section
      className={`mt-6 min-w-0 border-t border-royal/15 pt-6 ${
        !mobileBracketShowsFirstRoundOnly ? "hidden md:block" : ""
      }`}
      aria-labelledby="consolation-games-heading"
    >
      <SectionTitle id="consolation-games-heading">Consolation Games</SectionTitle>
      <div className="mt-4 flex flex-col gap-4">
        {sorted.map((g, mi) => (
          <BracketGameCard
            key={g.id}
            game={g}
            roundIndexDb={0}
            matchIndex={mi}
            prevRoundName={null}
            timeZone={tournamentTimezone}
            showHomeAway={showHomeAway}
          />
        ))}
      </div>
    </section>
  );
}

export function BracketsView({
  brackets,
  consolationGames = [],
  tournamentName,
  tournamentShortLabel,
  tournamentTimezone,
  headerLogoUrl,
  divisionName,
  showHomeAway = true,
}: {
  brackets: BracketWith[];
  /** Consolation games for this tournament (parent filters by division tab). */
  consolationGames?: GameRow[];
  /** Public tournament title for champion banner copy. */
  tournamentName: string;
  tournamentShortLabel?: string | null;
  /** IANA zone from `tournament.timezone` — venue wall-clock for game times. */
  tournamentTimezone?: string | null;
  headerLogoUrl?: string | null;
  divisionName?: string | null;
  /** When false (bracket-only / no pool play), hide (A)/(H) markers. */
  showHomeAway?: boolean;
}) {
  const consolationByDivision = useMemo(() => {
    const m = new Map<string, GameRow[]>();
    for (const g of consolationGames) {
      if (!g.divisionId) continue;
      const list = m.get(g.divisionId) ?? [];
      list.push(g);
      m.set(g.divisionId, list);
    }
    return m;
  }, [consolationGames]);

  if (brackets.length === 0) {
    return (
      <EmptyState
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path d="M4 4v6h4M4 7h4M20 4v6h-4M20 7h-4M4 20v-6h4M4 17h4M20 20v-6h-4M20 17h-4M8 7h2a2 2 0 012 2v6a2 2 0 01-2 2H8M16 7h-2a2 2 0 00-2 2v6a2 2 0 002 2h2" />
          </svg>
        }
        title="No bracket matches yet"
        description="Playoff brackets will appear here when published."
      />
    );
  }

  const renderExportToolbar = () => (
    <BracketExportControls
      brackets={brackets}
      consolationGames={consolationGames}
      tournamentName={tournamentName}
      tournamentShortLabel={tournamentShortLabel}
      divisionName={divisionName}
      headerLogoUrl={headerLogoUrl}
      tournamentTimezone={tournamentTimezone}
      showHomeAway={showHomeAway}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {brackets.map((b, i) => (
        <BracketSection
          key={b.id}
          b={b}
          tournamentName={tournamentName}
          tournamentTimezone={tournamentTimezone}
          consolationGames={consolationByDivision.get(b.divisionId) ?? []}
          showHomeAway={showHomeAway}
          exportToolbar={i === 0 ? renderExportToolbar : undefined}
        />
      ))}
    </div>
  );
}
