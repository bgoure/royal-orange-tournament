"use client";

import { Fragment, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { BracketRound } from "@prisma/client";
import { formatBracketGameScheduledAt } from "@/lib/datetime-tournament";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import { BracketGameCard } from "@/components/brackets/BracketGameCard";
import type { BracketWith, GameRow } from "@/components/brackets/bracket-types";
import {
  matchSortIndex,
  prevRoundNameForGame,
  slotLines,
  slotLineTextClass,
} from "@/components/brackets/bracket-slot-lines";
import { getBracketSlotSources } from "@/lib/brackets/game-slot-sources";
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
              <h3 className="text-sm font-medium text-zinc-800">{r.name}</h3>
              <p className="text-[11px] text-zinc-500">{roundTypeShortLabel(r.roundType)}</p>
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
}: {
  visibleRounds: BracketRound[];
  byRound: Map<string, GameRow[]>;
  timeZone?: string | null;
}) {
  const [roundIdx, setRoundIdx] = useState(0);
  if (visibleRounds.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-500">
        No rounds in this view. Consolation games appear here when the bracket includes a losers path.
      </p>
    );
  }

  const safeIdx = Math.min(roundIdx, Math.max(0, visibleRounds.length - 1));
  const r = visibleRounds[safeIdx]!;
  const games = (byRound.get(r.id) ?? []).sort((x, y) => matchSortIndex(x) - matchSortIndex(y));
  const prevRoundName = safeIdx > 0 ? visibleRounds[safeIdx - 1]!.name : null;

  return (
    <div className="mt-4 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm disabled:opacity-40"
          disabled={safeIdx <= 0}
          onClick={() => setRoundIdx((i) => Math.max(0, i - 1))}
          aria-label="Previous round"
        >
          ← Prev
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-semibold text-zinc-900">{r.name}</p>
          <p className="text-xs text-zinc-500">{roundTypeShortLabel(r.roundType)}</p>
        </div>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm disabled:opacity-40"
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
}: {
  game: GameRow;
  roundLabel: string;
  prevRoundName: string | null;
  timeZone?: string | null;
}) {
  const bm = game.bracketMatch;
  const mi = bm?.matchIndex ?? 0;
  const ri = game.bracketRound?.roundIndex ?? 0;
  const src = getBracketSlotSources(game);
  const away = slotLines(
    game.awayTeam,
    src.awayPool,
    src.awayRank,
    ri,
    mi,
    "away",
    prevRoundName,
  );
  const home = slotLines(
    game.homeTeam,
    src.homePool,
    src.homeRank,
    ri,
    mi,
    "home",
    prevRoundName,
  );
  const final = game.status === "FINAL" && game.homeRuns != null && game.awayRuns != null;
  const awayW = final && game.awayRuns! > game.homeRuns!;
  const homeW = final && game.homeRuns! > game.awayRuns!;

  return (
    <li className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{roundLabel}</p>
      <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamLogoMark team={away.team} />
          <span className={`min-w-0 truncate text-sm leading-snug ${slotLineTextClass(away)}`}>
            {away.primary}
          </span>
        </div>
        {final ? (
          <span
            className={`shrink-0 text-lg font-bold tabular-nums ${awayW ? "text-royal" : "text-zinc-400"}`}
          >
            {game.awayRuns}
            {awayW ? (
              <span className="ml-0.5 text-sm text-royal" aria-hidden>
                ✓
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-center text-[10px] text-zinc-400">vs</p>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamLogoMark team={home.team} />
          <span className={`min-w-0 truncate text-sm leading-snug ${slotLineTextClass(home)}`}>
            {home.primary}
          </span>
        </div>
        {final ? (
          <span
            className={`shrink-0 text-lg font-bold tabular-nums ${homeW ? "text-royal" : "text-zinc-400"}`}
          >
            {game.homeRuns}
            {homeW ? (
              <span className="ml-0.5 text-sm text-royal" aria-hidden>
                ✓
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      {away.secondary ? <p className="mt-1 text-xs text-zinc-500">{away.secondary}</p> : null}
      {home.secondary ? <p className="mt-0.5 text-xs text-zinc-500">{home.secondary}</p> : null}
      {final ? (
        <p className="mt-2 border-t border-zinc-100 pt-2 text-center text-xs text-zinc-500">Final</p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">
          Upcoming · {formatBracketGameScheduledAt(game.scheduledAt, timeZone, game.schedulePlaceholder)}
        </p>
      )}
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
    <ul className="flex flex-col gap-3 md:hidden">
      {sorted.map((g) => {
        const r = g.bracketRoundId ? roundById.get(g.bracketRoundId) : null;
        const prev = prevRoundNameForGame(roundsVisible, r?.id ?? null);
        return (
          <MobileMatchRow
            key={g.id}
            game={g}
            roundLabel={r?.name ?? "Round"}
            prevRoundName={prev}
            timeZone={timeZone}
          />
        );
      })}
    </ul>
  );
}

const scopeBtn =
  "min-h-10 rounded-full border px-3 py-2 text-sm font-medium transition-colors active:opacity-90";

function BracketSection({
  b,
  tournamentTimezone,
  mobileView,
  setMobileView,
}: {
  b: BracketWith;
  tournamentTimezone?: string | null;
  mobileView: "list" | "bracket";
  setMobileView: Dispatch<SetStateAction<"list" | "bracket">>;
}) {
  const [scope, setScope] = useState<BracketScopeFilter>("all");

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

  return (
    <section className="min-w-0" aria-labelledby={`bracket-heading-${b.id}`}>
      <h2 id={`bracket-heading-${b.id}`} className="text-lg font-semibold text-zinc-900">
        {b.name}
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Schedule and field are set per game. Open slots show pool finish (e.g. division · pool · finish) or the
        previous round until teams advance. Use division tabs in the header to switch age groups.
      </p>

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
                ? "border-royal bg-royal-50 text-royal shadow-sm"
                : "border-zinc-200 bg-zinc-50 text-zinc-600"
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
                ? "border-royal bg-royal-50 text-royal shadow-sm"
                : "border-zinc-200 bg-zinc-50 text-zinc-600"
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
                ? "border-royal bg-royal-50 text-royal shadow-sm"
                : "border-zinc-200 bg-zinc-50 text-zinc-600"
            }`}
            onClick={() => setScope("consolation")}
          >
            Consolation
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex md:hidden">
        <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-1">
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className={`min-h-11 min-w-[100px] rounded-full px-4 py-2 text-sm font-medium transition-colors active:opacity-90 ${
              mobileView === "list" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setMobileView("bracket")}
            className={`min-h-11 min-w-[100px] rounded-full px-4 py-2 text-sm font-medium transition-colors active:opacity-90 ${
              mobileView === "bracket" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
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
            key={`${b.id}-${scope}-${visibleRounds.map((r) => r.id).join("|")}`}
            visibleRounds={visibleRounds}
            byRound={byRound}
            timeZone={tournamentTimezone}
          />
        )}
      </div>
    </section>
  );
}

function FriendlyConsolationSection({
  games,
  tournamentTimezone,
}: {
  games: GameRow[];
  tournamentTimezone?: string | null;
}) {
  if (games.length === 0) return null;
  const sorted = [...games].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return (
    <section className="mt-8 min-w-0 border-t border-zinc-200 pt-8" aria-labelledby="friendly-consolation-heading">
      <h3 id="friendly-consolation-heading" className="text-base font-semibold text-zinc-900">
        Friendly consolation
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        Extra games seeded from pool finishing order. Not part of the main elimination bracket.
      </p>
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
        <ul className="flex flex-col gap-3">
          {sorted.map((g) => (
            <MobileMatchRow
              key={g.id}
              game={g}
              roundLabel="Friendly consolation"
              prevRoundName={null}
              timeZone={tournamentTimezone}
            />
          ))}
        </ul>
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
  /** Friendly consolation rows for this tournament (parent filters by division tab). */
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
    <div className="flex flex-col gap-12">
      {brackets.map((b) => (
        <Fragment key={b.id}>
          <BracketSection
            b={b}
            tournamentTimezone={tournamentTimezone}
            mobileView={mobileView}
            setMobileView={setMobileView}
          />
          <FriendlyConsolationSection
            games={consolationByDivision.get(b.divisionId) ?? []}
            tournamentTimezone={tournamentTimezone}
          />
        </Fragment>
      ))}
    </div>
  );
}
