"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import type { BracketRound } from "@prisma/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/ui/PublicHeading";
import { BracketGameCard } from "@/components/brackets/BracketGameCard";
import type { BracketWith, GameRow } from "@/components/brackets/bracket-types";
import { matchSortIndex, prevRoundNameForGame } from "@/components/brackets/bracket-slot-lines";
import {
  filterRoundsForScope,
  hasConsolationRounds,
  roundTypeShortLabel,
  type BracketScopeFilter,
} from "@/lib/brackets/bracket-display";

function BracketGrid({
  byRound,
  roundsOrdered,
  timeZone,
}: {
  byRound: Map<string, GameRow[]>;
  roundsOrdered: BracketRound[];
  timeZone?: string | null;
}) {
  return (
    <div
      {...{ [DIVISION_SWIPE_IGNORE]: "" }}
      className="mt-4 flex gap-6 overflow-x-auto pb-2 md:overflow-visible"
      role="region"
      aria-label="Bracket rounds"
    >
      {roundsOrdered.map((r, ri) => {
        const games = (byRound.get(r.id) ?? []).sort((x, y) => matchSortIndex(x) - matchSortIndex(y));
        const prevRoundName = ri > 0 ? roundsOrdered[ri - 1]!.name : null;
        return (
          <div
            key={r.id}
            className={`flex min-h-[320px] w-[min(100%,260px)] shrink-0 flex-col ${ri > 0 ? "border-l border-dashed border-zinc-200 pl-6" : ""}`}
          >
            <div className="mb-3 shrink-0">
              <h3 className="border-b border-royal/30 pb-1 text-xs font-bold uppercase tracking-[0.06em] text-royal">
                {r.name}
              </h3>
              <p className="mt-1 text-[11px] font-medium text-zinc-600">{roundTypeShortLabel(r.roundType)}</p>
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

function MobileBracketRoundNav({
  visibleRounds,
  byRound,
  timeZone,
  onRoundChange,
}: {
  visibleRounds: BracketRound[];
  byRound: Map<string, GameRow[]>;
  timeZone?: string | null;
  onRoundChange?: (roundIndex: number) => void;
}) {
  const [roundIdx, setRoundIdx] = useState(0);
  const safeIdx =
    visibleRounds.length === 0
      ? 0
      : Math.min(roundIdx, Math.max(0, visibleRounds.length - 1));

  useEffect(() => {
    onRoundChange?.(visibleRounds.length > 0 ? safeIdx : 0);
  }, [safeIdx, onRoundChange, visibleRounds.length]);

  if (visibleRounds.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-500">
        No rounds in this view. Consolation games appear here when the bracket includes a losers path.
      </p>
    );
  }

  const r = visibleRounds[safeIdx]!;
  const games = (byRound.get(r.id) ?? []).sort((x, y) => matchSortIndex(x) - matchSortIndex(y));
  const prevRoundName = safeIdx > 0 ? visibleRounds[safeIdx - 1]!.name : null;

  return (
    <div className="mt-4 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-lg border-2 border-zinc-200 bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-200 disabled:opacity-40"
          disabled={safeIdx <= 0}
          onClick={() => setRoundIdx((i) => Math.max(0, i - 1))}
          aria-label="Previous round"
        >
          ← Prev
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-royal">{r.name}</p>
          <p className="text-xs font-medium text-zinc-600">{roundTypeShortLabel(r.roundType)}</p>
        </div>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-lg border-2 border-zinc-200 bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-200 disabled:opacity-40"
          disabled={safeIdx >= visibleRounds.length - 1}
          onClick={() => setRoundIdx((i) => Math.min(visibleRounds.length - 1, i + 1))}
          aria-label="Next round"
        >
          Next →
        </button>
      </div>
      <div className="flex flex-col gap-4">
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
            />
          ))
        )}
      </div>
    </div>
  );
}

function MobileMatchRow({
  game,
  roundLabel,
  prevRoundName,
  timeZone,
  gLabelFallbackIndexZeroBased,
}: {
  game: GameRow;
  roundLabel: string;
  prevRoundName: string | null;
  timeZone?: string | null;
  gLabelFallbackIndexZeroBased: number;
}) {
  const bm = game.bracketMatch;
  const mi = bm?.matchIndex ?? 0;
  const ri = game.bracketRound?.roundIndex ?? 0;

  return (
    <li className="min-w-0 list-none">
      <BracketGameCard
        game={game}
        roundIndexDb={ri}
        matchIndex={mi}
        prevRoundName={prevRoundName}
        timeZone={timeZone}
        roundLabel={roundLabel}
        gLabelFallbackIndexZeroBased={gLabelFallbackIndexZeroBased}
      />
    </li>
  );
}

function BracketMobileList({
  games,
  roundsVisible,
  timeZone,
}: {
  games: GameRow[];
  roundsVisible: BracketRound[];
  timeZone?: string | null;
}) {
  const sorted = [...games].sort((a, c) => {
    const ra = a.bracketRound?.roundIndex ?? 0;
    const rb = c.bracketRound?.roundIndex ?? 0;
    if (ra !== rb) return ra - rb;
    return matchSortIndex(a) - matchSortIndex(c);
  });
  const roundById = new Map(roundsVisible.map((r) => [r.id, r]));

  return (
    <ul className="flex list-none flex-col gap-3 p-0 md:hidden">
      {sorted.map((g, listIdx) => {
        const r = g.bracketRoundId ? roundById.get(g.bracketRoundId) : null;
        const prev = prevRoundNameForGame(roundsVisible, r?.id ?? null);
        return (
          <MobileMatchRow
            key={g.id}
            game={g}
            roundLabel={r?.name ?? "Round"}
            prevRoundName={prev}
            timeZone={timeZone}
            gLabelFallbackIndexZeroBased={listIdx}
          />
        );
      })}
    </ul>
  );
}

const scopeBtn =
  "min-h-10 rounded-lg border-2 px-[14px] py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 active:opacity-90 md:min-h-10";

function BracketSection({
  b,
  tournamentTimezone,
  mobileView,
  setMobileView,
  consolationGames,
}: {
  b: BracketWith;
  tournamentTimezone?: string | null;
  mobileView: "list" | "bracket";
  setMobileView: Dispatch<SetStateAction<"list" | "bracket">>;
  consolationGames: GameRow[];
}) {
  const [scope, setScope] = useState<BracketScopeFilter>("all");
  const [mobileRoundIdx, setMobileRoundIdx] = useState(0);

  const roundsSorted = useMemo(
    () => [...b.rounds].sort((a, c) => a.roundIndex - c.roundIndex),
    [b.rounds],
  );
  const showScope = hasConsolationRounds(roundsSorted);

  const visibleRounds = useMemo(() => {
    const effectiveScope = showScope ? scope : "all";
    return filterRoundsForScope(roundsSorted, effectiveScope);
  }, [roundsSorted, scope, showScope]);

  const visibleRoundIds = useMemo(() => new Set(visibleRounds.map((r) => r.id)), [visibleRounds]);

  const gamesInScope = useMemo(
    () => b.games.filter((g) => g.bracketRoundId && visibleRoundIds.has(g.bracketRoundId)),
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

  const visibleRoundsKey = useMemo(() => visibleRounds.map((r) => r.id).join("|"), [visibleRounds]);

  return (
    <section className="min-w-0" aria-labelledby={`bracket-heading-${b.id}`}>
      <SectionTitle id={`bracket-heading-${b.id}`} className="normal-case tracking-normal">
        {b.name}
      </SectionTitle>

      {showScope ? (
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Winners and consolation bracket"
        >
          <button
            type="button"
            role="tab"
            aria-selected={scope === "all"}
            className={`${scopeBtn} ${
              scope === "all"
                ? "border-royal bg-royal text-white shadow-sm"
                : "border-zinc-200 bg-zinc-100 text-zinc-800 hover:border-zinc-300 hover:bg-zinc-200"
            }`}
            onClick={() => setScope("all")}
          >
            All rounds
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "main"}
            className={`${scopeBtn} ${
              scope === "main"
                ? "border-royal bg-royal text-white shadow-sm"
                : "border-zinc-200 bg-zinc-100 text-zinc-800 hover:border-zinc-300 hover:bg-zinc-200"
            }`}
            onClick={() => setScope("main")}
          >
            Winners
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "consolation"}
            className={`${scopeBtn} ${
              scope === "consolation"
                ? "border-royal bg-royal text-white shadow-sm"
                : "border-zinc-200 bg-zinc-100 text-zinc-800 hover:border-zinc-300 hover:bg-zinc-200"
            }`}
            onClick={() => setScope("consolation")}
          >
            Consolation
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex md:hidden">
        <div
          className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100/80 p-1 shadow-sm"
          role="group"
          aria-label="Mobile bracket view"
        >
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className={`min-h-11 min-w-[100px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 active:opacity-90 ${
              mobileView === "list"
                ? "bg-royal-50 text-royal shadow-sm ring-2 ring-royal/25"
                : "text-zinc-700"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileView("bracket");
              setMobileRoundIdx(0);
            }}
            className={`min-h-11 min-w-[100px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 active:opacity-90 ${
              mobileView === "bracket"
                ? "bg-royal-50 text-royal shadow-sm ring-2 ring-royal/25"
                : "text-zinc-700"
            }`}
          >
            Bracket
          </button>
        </div>
      </div>

      <div className="mt-4 hidden md:block">
        <BracketGrid byRound={byRound} roundsOrdered={visibleRounds} timeZone={tournamentTimezone} />
      </div>
      <div className="mt-4 md:hidden">
        {mobileView === "list" ? (
          <BracketMobileList games={gamesInScope} roundsVisible={visibleRounds} timeZone={tournamentTimezone} />
        ) : (
          <MobileBracketRoundNav
            key={`${b.id}-${scope}-${visibleRoundsKey}`}
            visibleRounds={visibleRounds}
            byRound={byRound}
            timeZone={tournamentTimezone}
            onRoundChange={setMobileRoundIdx}
          />
        )}
      </div>

      <ConsolationGamesSection
        games={consolationGames}
        tournamentTimezone={tournamentTimezone}
        mobileView={mobileView}
        mobileBracketShowsFirstRoundOnly={mobileView === "bracket" && mobileRoundIdx === 0}
      />
    </section>
  );
}

function ConsolationGamesSection({
  games,
  tournamentTimezone,
  mobileView,
  mobileBracketShowsFirstRoundOnly,
}: {
  games: GameRow[];
  tournamentTimezone?: string | null;
  mobileView: "list" | "bracket";
  /** When false, hide this block below `md` while Bracket mobile view is active (not on round 1). */
  mobileBracketShowsFirstRoundOnly: boolean;
}) {
  if (games.length === 0) return null;
  const sorted = [...games].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const showOnMobile =
    mobileView === "list" || (mobileView === "bracket" && mobileBracketShowsFirstRoundOnly);

  return (
    <section
      className={`mt-6 min-w-0 border-t border-royal/15 pt-6 ${!showOnMobile ? "hidden md:block" : ""}`}
      aria-labelledby="consolation-games-heading"
    >
      <SectionTitle id="consolation-games-heading">Consolation Games</SectionTitle>
      <div className="mt-4 hidden md:flex md:flex-col md:gap-4">
        {sorted.map((g, mi) => (
          <BracketGameCard
            key={g.id}
            game={g}
            roundIndexDb={0}
            matchIndex={mi}
            prevRoundName={null}
            timeZone={tournamentTimezone}
          />
        ))}
      </div>
      <div className="mt-4 md:hidden">
        {mobileView === "list" ? (
          <ul className="flex list-none flex-col gap-3 p-0">
            {sorted.map((g, listIdx) => (
              <MobileMatchRow
                key={g.id}
                game={g}
                roundLabel="Consolation"
                prevRoundName={null}
                timeZone={tournamentTimezone}
                gLabelFallbackIndexZeroBased={listIdx}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-4">
            {sorted.map((g, mi) => (
              <BracketGameCard
                key={g.id}
                game={g}
                roundIndexDb={0}
                matchIndex={mi}
                prevRoundName={null}
                timeZone={tournamentTimezone}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function BracketsView({
  brackets,
  consolationGames = [],
  tournamentTimezone,
}: {
  brackets: BracketWith[];
  /** Consolation games for this tournament (parent filters by division tab). */
  consolationGames?: GameRow[];
  /** IANA zone from `tournament.timezone` — venue wall-clock for game times. */
  tournamentTimezone?: string | null;
}) {
  const [mobileView, setMobileView] = useState<"bracket" | "list">("list");

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

  return (
    <div className="flex flex-col gap-6">
      {brackets.map((b) => (
        <BracketSection
          key={b.id}
          b={b}
          tournamentTimezone={tournamentTimezone}
          mobileView={mobileView}
          setMobileView={setMobileView}
          consolationGames={consolationByDivision.get(b.divisionId) ?? []}
        />
      ))}
    </div>
  );
}
