"use client";

import { useState } from "react";
import type {
  Bracket,
  BracketMatch,
  BracketRound,
  Division,
  Field,
  Game,
  Pool,
  Team,
} from "@prisma/client";
import { formatBracketGameScheduledAt } from "@/lib/datetime-tournament";
import { formatFieldWithLocation } from "@/lib/field-display";
import { EmptyState } from "@/components/ui/EmptyState";

type TeamWithPool = Team & {
  pool: (Pool & { division: Division }) | null;
};

type BracketMatchWithPools = BracketMatch & {
  homeSourcePool: (Pool & { division: Division }) | null;
  awaySourcePool: (Pool & { division: Division }) | null;
};

type GameRow = Game & {
  homeTeam: TeamWithPool | null;
  awayTeam: TeamWithPool | null;
  field: Field & { location: { name: string } };
  bracketRound: BracketRound | null;
  bracketMatch: BracketMatchWithPools | null;
};

type BracketWith = Bracket & {
  rounds: BracketRound[];
  games: GameRow[];
};

function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function matchSortIndex(g: GameRow): number {
  return g.bracketMatch?.matchIndex ?? g.bracketPosition ?? 0;
}

function slotLines(
  team: TeamWithPool | null,
  sourcePool: (Pool & { division: Division }) | null | undefined,
  rank: number | null | undefined,
  roundIndex: number,
  bracketMatchIndex: number,
  slot: "home" | "away",
  prevRoundName: string | null,
): { primary: string; secondary: string | null } {
  if (team) {
    const secondary = team.pool
      ? `${team.pool.division.name} · ${team.pool.name}`
      : null;
    return { primary: team.name, secondary };
  }
  if (sourcePool && rank != null) {
    return {
      primary: `${ordinal(rank)} place · ${sourcePool.division.name}`,
      secondary: sourcePool.name,
    };
  }
  if (roundIndex > 0 && prevRoundName) {
    const feederIdx = slot === "home" ? bracketMatchIndex * 2 : bracketMatchIndex * 2 + 1;
    const matchNo = feederIdx + 1;
    return {
      primary: "TBD",
      secondary: `Winner of ${prevRoundName} · Match ${matchNo}`,
    };
  }
  return { primary: "TBD", secondary: null };
}

function BracketMatchCard({
  game,
  roundIndex,
  matchIndex,
  prevRoundName,
  timeZone,
}: {
  game: GameRow;
  roundIndex: number;
  matchIndex: number;
  prevRoundName: string | null;
  timeZone?: string | null;
}) {
  const bm = game.bracketMatch;
  const bracketMatchIndex = bm?.matchIndex ?? matchIndex;
  const away = slotLines(
    game.awayTeam,
    bm?.awaySourcePool,
    bm?.awaySourceRank,
    roundIndex,
    bracketMatchIndex,
    "away",
    prevRoundName,
  );
  const home = slotLines(
    game.homeTeam,
    bm?.homeSourcePool,
    bm?.homeSourceRank,
    roundIndex,
    bracketMatchIndex,
    "home",
    prevRoundName,
  );
  const t = formatBracketGameScheduledAt(game.scheduledAt, timeZone);
  const scheduled =
    game.gameNumber != null && game.gameNumber !== ""
      ? `Game #${game.gameNumber} · ${t}`
      : t;

  return (
    <article
      className="rounded-xl border border-zinc-200 bg-white shadow-sm"
      aria-label={`Bracket match ${matchIndex + 1}`}
    >
      <div className="border-b border-zinc-100 bg-zinc-50/80 px-3 py-1.5">
        <p className="text-[11px] leading-snug text-zinc-600">
          {scheduled}
          <span className="mx-1 text-zinc-300">·</span>
          {formatFieldWithLocation(game.field.name, game.field.location.name)}
        </p>
      </div>
      <div className="divide-y divide-zinc-100 px-3 py-0 text-sm">
        <div className="py-2.5">
          <p className="font-medium text-zinc-900">{away.primary}</p>
          {away.secondary ? <p className="mt-0.5 text-xs text-zinc-500">{away.secondary}</p> : null}
        </div>
        <div className="py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">vs</p>
          <p className="font-medium text-zinc-900">{home.primary}</p>
          {home.secondary ? <p className="mt-0.5 text-xs text-zinc-500">{home.secondary}</p> : null}
        </div>
      </div>
      {game.status === "FINAL" && game.homeRuns != null && game.awayRuns != null ? (
        <p className="border-t border-zinc-100 px-3 py-2 text-xs tabular-nums text-zinc-600">
          Final: {game.awayRuns}–{game.homeRuns} (away–home)
        </p>
      ) : (
        <p className="border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-500">{game.status}</p>
      )}
    </article>
  );
}

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
    <div className="mt-4 flex gap-6 overflow-x-auto pb-2 md:overflow-visible">
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
              <p className="text-[11px] text-zinc-500">{r.roundType.replaceAll("_", " ")}</p>
            </div>
            <div className="flex flex-1 flex-col justify-around gap-4">
              {games.length === 0 ? (
                <p className="text-sm text-zinc-500">Matchups TBA.</p>
              ) : (
                games.map((g, mi) => (
                  <BracketMatchCard
                    key={g.id}
                    game={g}
                    roundIndex={ri}
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
  const away = slotLines(
    game.awayTeam,
    bm?.awaySourcePool,
    bm?.awaySourceRank,
    ri,
    mi,
    "away",
    prevRoundName,
  );
  const home = slotLines(
    game.homeTeam,
    bm?.homeSourcePool,
    bm?.homeSourceRank,
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
      <p className="mt-2 text-sm font-semibold text-zinc-900">{away.primary}</p>
      <p className="mt-2 text-center text-[10px] text-zinc-400">vs</p>
      <p className="text-sm font-semibold text-zinc-900">{home.primary}</p>
      {final ? (
        <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
          <span className={`text-lg font-bold tabular-nums ${awayW ? "text-royal" : "text-zinc-400"}`}>
            {game.awayRuns}
          </span>
          <span className="text-xs text-zinc-500">Final</span>
          <span className={`text-lg font-bold tabular-nums ${homeW ? "text-royal" : "text-zinc-400"}`}>
            {game.homeRuns}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">
          Upcoming · {formatBracketGameScheduledAt(game.scheduledAt, timeZone)}
        </p>
      )}
    </li>
  );
}

function BracketMobileList({ b, timeZone }: { b: BracketWith; timeZone?: string | null }) {
  const sorted = [...b.games].sort((a, c) => {
    const ra = a.bracketRound?.roundIndex ?? 0;
    const rb = c.bracketRound?.roundIndex ?? 0;
    if (ra !== rb) return ra - rb;
    return matchSortIndex(a) - matchSortIndex(c);
  });
  const roundById = new Map(b.rounds.map((r) => [r.id, r]));

  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {sorted.map((g) => {
        const r = g.bracketRoundId ? roundById.get(g.bracketRoundId) : null;
        const prev =
          r && r.roundIndex > 0
            ? b.rounds.find((x) => x.roundIndex === r.roundIndex - 1)?.name ?? null
            : null;
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

export function BracketsView({
  brackets,
  tournamentTimezone,
}: {
  brackets: BracketWith[];
  /** IANA zone from `tournament.timezone` — venue wall-clock for game times. */
  tournamentTimezone?: string | null;
}) {
  const [mobileView, setMobileView] = useState<"bracket" | "list">("list");

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
      {brackets.map((b) => {
        const byRound = new Map<string, GameRow[]>();
        for (const g of b.games) {
          const key = g.bracketRoundId ?? "unassigned";
          const list = byRound.get(key) ?? [];
          list.push(g);
          byRound.set(key, list);
        }
        const roundsOrdered = [...b.rounds].sort((a, c) => a.roundIndex - c.roundIndex);

        return (
          <section key={b.id} className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-900">{b.name}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Schedule and field are set per game; open slots show pool finish or the previous round until teams
              advance.
            </p>

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
              <BracketGrid byRound={byRound} roundsOrdered={roundsOrdered} timeZone={tournamentTimezone} />
            </div>
            <div className="mt-4 md:hidden">
              {mobileView === "list" ? (
                <BracketMobileList b={b} timeZone={tournamentTimezone} />
              ) : (
                <div className="overflow-x-auto pb-2">
                  <BracketGrid byRound={byRound} roundsOrdered={roundsOrdered} timeZone={tournamentTimezone} />
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
