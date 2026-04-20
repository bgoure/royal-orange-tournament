"use client";

import { Fragment, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { BracketRound } from "@prisma/client";
import { formatBracketGameScheduledAt } from "@/lib/datetime-tournament";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/ui/PublicHeading";
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
  const t = formatBracketGameScheduledAt(game.scheduledAt, timeZone, game.schedulePlaceholder);
  const scheduled =
    game.gameNumber != null && game.gameNumber !== ""
      ? `Game #${game.gameNumber} · ${t}`
      : t;

  return (
    <li className="min-w-0 list-none rounded-2xl border border-zinc-200 border-l-2 border-l-royal/90 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
      <div className="border-b border-royal/10 bg-royal-50/50 px-3 py-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-royal">{roundLabel}</p>
        <p className="mt-0.5 text-[11px] font-medium leading-snug text-zinc-700">
          {scheduled}
          <span className="mx-1 text-zinc-300">·</span>
          {game.field.name}
        </p>
      </div>
      <div className="divide-y divide-zinc-100 px-3 py-0 text-sm">
        <div className="py-2.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <TeamLogoMark team={away.team} />
              <span className={`min-w-0 truncate leading-snug ${slotLineTextClass(away)}`}>{away.primary}</span>
            </div>
            {final ? (
              <span
                className={`shrink-0 text-lg font-bold tabular-nums ${awayW ? "text-royal" : "text-zinc-400"}`}
                aria-label={awayW ? "Away wins" : undefined}
              >
                {game.awayRuns}
                {awayW ? (
                  <span className="ml-1 text-sm font-semibold text-royal" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
          {away.secondary ? <p className="mt-0.5 text-xs text-zinc-500">{away.secondary}</p> : null}
        </div>
        <div className="py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">vs</p>
          <div className="mt-0.5 flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <TeamLogoMark team={home.team} />
              <span className={`min-w-0 truncate leading-snug ${slotLineTextClass(home)}`}>{home.primary}</span>
            </div>
            {final ? (
              <span
                className={`shrink-0 text-lg font-bold tabular-nums ${homeW ? "text-royal" : "text-zinc-400"}`}
                aria-label={homeW ? "Home wins" : undefined}
              >
                {game.homeRuns}
                {homeW ? (
                  <span className="ml-1 text-sm font-semibold text-royal" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
          {home.secondary ? <p className="mt-0.5 text-xs text-zinc-500">{home.secondary}</p> : null}
        </div>
      </div>
      {final ? (
        <p className="border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-500">Final</p>
      ) : (
        <p className="border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-500">{game.status}</p>
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
    <ul className="flex list-none flex-col gap-3 p-0 md:hidden">
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
  "min-h-10 rounded-lg border-2 px-[14px] py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 active:opacity-90 md:min-h-10";

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
      <SectionTitle id={`bracket-heading-${b.id}`} className="normal-case tracking-normal">
        {b.name}
      </SectionTitle>
      <p className="mt-2 text-sm text-zinc-600">
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
            onClick={() => setMobileView("bracket")}
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

function ConsolationGamesSection({
  games,
  tournamentTimezone,
  mobileView,
}: {
  games: GameRow[];
  tournamentTimezone?: string | null;
  mobileView: "list" | "bracket";
}) {
  if (games.length === 0) return null;
  const sorted = [...games].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return (
    <section className="mt-6 min-w-0 border-t border-royal/15 pt-6" aria-labelledby="consolation-games-heading">
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
            {sorted.map((g) => (
              <MobileMatchRow
                key={g.id}
                game={g}
                roundLabel="Consolation"
                prevRoundName={null}
                timeZone={tournamentTimezone}
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
        <Fragment key={b.id}>
          <BracketSection
            b={b}
            tournamentTimezone={tournamentTimezone}
            mobileView={mobileView}
            setMobileView={setMobileView}
          />
          <ConsolationGamesSection
            games={consolationByDivision.get(b.divisionId) ?? []}
            tournamentTimezone={tournamentTimezone}
            mobileView={mobileView}
          />
        </Fragment>
      ))}
    </div>
  );
}
