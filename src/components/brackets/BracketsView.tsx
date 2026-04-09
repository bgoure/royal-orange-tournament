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
import { formatFieldWithLocation } from "@/lib/field-display";

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

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
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
}: {
  game: GameRow;
  roundIndex: number;
  matchIndex: number;
  prevRoundName: string | null;
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
  const scheduled =
    game.gameNumber != null && game.gameNumber !== ""
      ? `Game #${game.gameNumber} · ${fmtTime(game.scheduledAt)}`
      : fmtTime(game.scheduledAt);

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

export function BracketsView({ brackets }: { brackets: BracketWith[] }) {
  if (brackets.length === 0) {
    return <p className="text-sm text-zinc-500">Playoff brackets will appear here once published.</p>;
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
            <div className="mt-4 flex gap-6 overflow-x-auto pb-2">
              {roundsOrdered.map((r, ri) => {
                const games = (byRound.get(r.id) ?? []).sort(
                  (x, y) => matchSortIndex(x) - matchSortIndex(y),
                );
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
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
