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
  LIVE: "bg-red-100 text-red-800 animate-pulse",
  FINAL: "bg-royal-50 text-royal",
  POSTPONED: "bg-amber-100 text-amber-900",
  CANCELLED: "bg-zinc-200 text-zinc-600 line-through",
};

const cardBorder: Record<string, string> = {
  LIVE: "border-red-200 bg-red-50/30",
  default: "border-zinc-200 bg-white",
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

function GameCard({ g, compact }: { g: GameWithTeams; compact?: boolean }) {
  const st = statusStyles[g.status] ?? statusStyles.SCHEDULED;
  const border = cardBorder[g.status] ?? cardBorder.default;
  const hasScore = g.homeRuns != null && g.awayRuns != null;

  return (
    <li
      className={`rounded-2xl border shadow-sm ${border} ${compact ? "w-[200px] shrink-0 px-3 py-2.5" : "px-4 py-3"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">{compact ? fmtTimeShort(g.scheduledAt) : fmtTime(g.scheduledAt)}</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st}`}>{g.status}</span>
      </div>

      {hasScore ? (
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-[13px] font-semibold text-zinc-900">{g.awayTeam?.name ?? "TBD"}</p>
          </div>
          <div className="flex items-center gap-0.5 px-1">
            <span className={`${compact ? "text-base" : "text-lg"} font-bold tabular-nums text-zinc-900`}>{g.awayRuns}</span>
            <span className="text-[10px] text-zinc-400">–</span>
            <span className={`${compact ? "text-base" : "text-lg"} font-bold tabular-nums text-zinc-900`}>{g.homeRuns}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-zinc-900">{g.homeTeam?.name ?? "TBD"}</p>
          </div>
        </div>
      ) : (
        <div className="mt-1.5">
          <p className="text-[13px] font-semibold text-zinc-900">
            {g.awayTeam?.name ?? "TBD"}
            <span className="mx-1 text-[10px] font-normal text-zinc-400">vs</span>
            {g.homeTeam?.name ?? "TBD"}
          </p>
        </div>
      )}

      <p className="mt-1 text-[10px] leading-tight text-zinc-500">
        {formatFieldWithLocation(g.field.name, g.field.location.name)}
        {g.pool ? ` · ${g.pool.name}` : ""}
      </p>
    </li>
  );
}

function fmtTimeShort(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function GameList({
  games,
  emptyMessage = "No games match your filters.",
  horizontal,
}: {
  games: GameWithTeams[];
  emptyMessage?: string;
  horizontal?: boolean;
}) {
  if (games.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMessage}</p>;
  }

  if (horizontal) {
    return (
      <ul className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 snap-x snap-mandatory">
        {games.map((g) => (
          <GameCard key={g.id} g={g} compact />
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {games.map((g) => (
        <GameCard key={g.id} g={g} />
      ))}
    </ul>
  );
}
