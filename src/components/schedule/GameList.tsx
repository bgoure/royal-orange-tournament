import type { Division, Field, Game, Pool, Team } from "@prisma/client";
import { formatFieldWithLocation } from "@/lib/field-display";

export type GameWithTeams = Game & {
  field: Field & { location: { name: string } };
  homeTeam: Team | null;
  awayTeam: Team | null;
  pool: (Pool & { division: Division }) | null;
};

const statusStyles: Record<string, string> = {
  SCHEDULED: "bg-zinc-100 text-zinc-700",
  LIVE: "bg-red-100 text-red-800",
  FINAL: "bg-emerald-100 text-emerald-900",
  POSTPONED: "bg-amber-100 text-amber-900",
  CANCELLED: "bg-zinc-200 text-zinc-600 line-through",
};

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function GameList({
  games,
  emptyMessage = "No games match your filters.",
}: {
  games: GameWithTeams[];
  emptyMessage?: string;
}) {
  if (games.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {games.map((g) => {
        const st = statusStyles[g.status] ?? statusStyles.SCHEDULED;
        const score =
          g.homeRuns != null && g.awayRuns != null ? `${g.homeRuns}–${g.awayRuns}` : "—";
        return (
          <li
            key={g.id}
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs text-zinc-500">{fmtTime(g.scheduledAt)}</p>
              <p className="font-medium text-zinc-900">
                <span className="text-zinc-800">{g.awayTeam ? g.awayTeam.name : "TBD"}</span>
                <span className="mx-1.5 text-zinc-400">vs</span>
                <span className="text-zinc-800">{g.homeTeam ? g.homeTeam.name : "TBD"}</span>
              </p>
              <p className="text-xs text-zinc-500">
                {formatFieldWithLocation(g.field.name, g.field.location.name)}
                {g.pool ? ` · ${g.pool.name}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:justify-end">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st}`}>{g.status}</span>
              <span className="tabular-nums text-sm font-semibold text-zinc-900">{score}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
