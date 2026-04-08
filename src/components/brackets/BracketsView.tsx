import type { Bracket, BracketRound, Field, Game, Team } from "@prisma/client";
import { formatFieldWithLocation } from "@/lib/field-display";

type GameRow = Game & {
  homeTeam: Team | null;
  awayTeam: Team | null;
  field: Field & { location: { name: string } };
  bracketRound: BracketRound | null;
};

type BracketWith = Bracket & {
  rounds: BracketRound[];
  games: GameRow[];
};

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function BracketsView({ brackets }: { brackets: BracketWith[] }) {
  if (brackets.length === 0) {
    return <p className="text-sm text-zinc-500">Playoff brackets will appear here once published.</p>;
  }

  return (
    <div className="flex flex-col gap-10">
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
          <section key={b.id}>
            <h2 className="text-lg font-semibold text-zinc-900">{b.name}</h2>
                <div className="mt-4 flex flex-col gap-6">
                  {roundsOrdered.map((r) => {
                    const games = (byRound.get(r.id) ?? []).sort(
                      (x, y) => (x.bracketPosition ?? 0) - (y.bracketPosition ?? 0),
                    );
                    return (
                      <div key={r.id}>
                        <h3 className="text-sm font-medium text-zinc-700">
                          {r.name}
                          <span className="ml-2 text-xs font-normal text-zinc-500">({r.roundType})</span>
                        </h3>
                        {games.length === 0 ? (
                          <p className="mt-2 text-sm text-zinc-500">Matchups TBA.</p>
                        ) : (
                          <ul className="mt-2 flex flex-col gap-2">
                            {games.map((g) => (
                              <li
                                key={g.id}
                                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm"
                              >
                                <p className="text-xs text-zinc-500">
                                  {fmtTime(g.scheduledAt)} ·{" "}
                                  {formatFieldWithLocation(g.field.name, g.field.location.name)}
                                </p>
                                <p className="font-medium text-zinc-900">
                                  {g.awayTeam ? g.awayTeam.abbreviation ?? g.awayTeam.name : "TBD"} @{" "}
                                  {g.homeTeam ? g.homeTeam.abbreviation ?? g.homeTeam.name : "TBD"}
                                  {g.status === "FINAL" && g.homeRuns != null && g.awayRuns != null ? (
                                    <span className="ml-2 tabular-nums text-zinc-600">
                                      ({g.awayRuns}–{g.homeRuns})
                                    </span>
                                  ) : (
                                    <span className="ml-2 text-xs font-normal text-zinc-500">({g.status})</span>
                                  )}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
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
