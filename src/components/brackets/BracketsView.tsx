"use client";

import { useMemo, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/ui/PublicHeading";
import { BracketExportControls } from "@/components/brackets/BracketExportControls";
import { BracketViewerPrefsProvider } from "@/components/brackets/BracketViewerPrefs";
import {
  assertSingleInteractiveTree,
  bracketTreeMounts,
} from "@/components/brackets/bracket-mount";
import { BracketZoomShell, BRACKET_DESKTOP_WIDE_CLASS, useBracketPhotoExpandAll } from "@/components/brackets/BracketZoomShell";
import { publicBracketHeading } from "@/lib/brackets/bracket-public-title";
import { BracketGameCard } from "@/components/brackets/BracketGameCard";
import { BidirectionalDeBracket } from "@/components/brackets/BidirectionalDeBracket";
import { ChronologicalRoundBracket } from "@/components/brackets/ChronologicalRoundBracket";
import { EspnStyleBracket } from "@/components/brackets/EspnStyleBracket";
import { ChampionCelebration, type ChampionCelebrationProps } from "@/components/brackets/ChampionCelebration";
import type { BracketWith, GameRow } from "@/components/brackets/bracket-types";
import { resolveChampionFromBracket, shouldShowChampionCelebration } from "@/lib/brackets/bracket-champion";
import { isObaDePresetKey } from "@/lib/brackets/oba-de-presets";
import { filterRoundsForScope } from "@/lib/brackets/bracket-display";

export function BracketDesktopTree({
  b,
  tournamentTimezone,
  showHomeAway = true,
  fitContent = false,
  celebration = null,
}: {
  b: BracketWith;
  tournamentTimezone?: string | null;
  showHomeAway?: boolean;
  fitContent?: boolean;
  celebration?: ChampionCelebrationProps | null;
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
        persistKey={showAllRounds ? undefined : b.id}
        celebration={celebration}
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
        persistKey={showAllRounds ? undefined : b.id}
      />
    );
  }
  return (
    <EspnStyleBracket
      byRound={byRound}
      roundsOrdered={visibleRounds}
      timeZone={tournamentTimezone}
      showHomeAway={showHomeAway}
      fitContent={showAllRounds}
      expandAll={showAllRounds}
      persistKey={showAllRounds ? undefined : b.id}
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
  const celebration = useMemo((): ChampionCelebrationProps | null => {
    if (!champion || !shouldShowChampionCelebration(champion)) return null;
    const others =
      champion.isQualifier && champion.qualifiedTeams
        ? champion.qualifiedTeams
            .filter((t) => t.id !== champion.winnerTeam.id)
            .map((t) => t.name)
            .filter(Boolean)
        : [];
    return {
      tournamentName,
      divisionName: champion.divisionName,
      winnerTeam: champion.winnerTeam,
      subtitle: others.length > 0 ? `Also advancing: ${others.join(" · ")}` : undefined,
    };
  }, [champion, tournamentName]);
  // One tree for every breakpoint — mobile differences are CSS inside this mount.
  const treeMount = useMemo(() => assertSingleInteractiveTree(bracketTreeMounts(b.id)), [b.id]);
  const isOba13 = b.presetKey === "oba_de_13";

  return (
    <section className="min-w-0" aria-labelledby={`bracket-heading-${b.id}`}>
      {celebration && !isOba13 ? (
        <ChampionCelebration {...celebration} className="mb-4" />
      ) : null}
      <div className={BRACKET_DESKTOP_WIDE_CLASS}>
      <SectionTitle id={`bracket-heading-${b.id}`} className="normal-case tracking-normal">
        {publicBracketHeading(b.name, b.division.name)}
        {b.isQualifier ? (
          <span className="ml-2 text-sm font-normal text-zinc-600">
            (qualifier · top {b.qualifyingTeamCount})
          </span>
        ) : null}
      </SectionTitle>

      <div className={treeMount.className}>
        <BracketZoomShell toolbarStart={exportToolbar?.()}>
          <BracketDesktopTree
            b={b}
            tournamentTimezone={tournamentTimezone}
            showHomeAway={showHomeAway}
            celebration={celebration}
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
    <BracketViewerPrefsProvider>
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
    </BracketViewerPrefsProvider>
  );
}
