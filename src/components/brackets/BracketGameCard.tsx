import { formatBracketGameScheduledAt } from "@/lib/datetime-tournament";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import type { GameRow } from "@/components/brackets/bracket-types";
import { getBracketSlotSources } from "@/lib/brackets/game-slot-sources";
import { slotLines, slotLineTextClass } from "@/components/brackets/bracket-slot-lines";

export function BracketGameCard({
  game,
  roundIndexDb,
  matchIndex,
  prevRoundName,
  timeZone,
}: {
  game: GameRow;
  /** BracketRound.roundIndex from DB (not index in UI column list). */
  roundIndexDb: number;
  matchIndex: number;
  prevRoundName: string | null;
  timeZone?: string | null;
}) {
  const bm = game.bracketMatch;
  const bracketMatchIndex = bm?.matchIndex ?? matchIndex;
  const src = getBracketSlotSources(game);
  const away = slotLines(
    game.awayTeam,
    src.awayPool,
    src.awayRank,
    roundIndexDb,
    bracketMatchIndex,
    "away",
    prevRoundName,
  );
  const home = slotLines(
    game.homeTeam,
    src.homePool,
    src.homeRank,
    roundIndexDb,
    bracketMatchIndex,
    "home",
    prevRoundName,
  );
  const t = formatBracketGameScheduledAt(game.scheduledAt, timeZone, game.schedulePlaceholder);
  const scheduled =
    game.gameNumber != null && game.gameNumber !== ""
      ? `Game #${game.gameNumber} · ${t}`
      : t;

  const final = game.status === "FINAL" && game.homeRuns != null && game.awayRuns != null;
  const awayW = final && game.awayRuns! > game.homeRuns!;
  const homeW = final && game.homeRuns! > game.awayRuns!;

  return (
    <article
      className="rounded-xl border border-zinc-200 bg-white shadow-sm"
      aria-label={`Bracket match ${matchIndex + 1}`}
    >
      <div className="border-b border-zinc-100 bg-zinc-50/80 px-3 py-1.5">
        <p className="text-[11px] leading-snug text-zinc-600">
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
              <p className={`min-w-0 truncate leading-snug ${slotLineTextClass(away)}`}>{away.primary}</p>
            </div>
            {final ? (
              <span
                className={`shrink-0 text-lg font-bold tabular-nums ${
                  awayW ? "text-royal" : "text-zinc-400"
                }`}
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
              <p className={`min-w-0 truncate leading-snug ${slotLineTextClass(home)}`}>{home.primary}</p>
            </div>
            {final ? (
              <span
                className={`shrink-0 text-lg font-bold tabular-nums ${
                  homeW ? "text-royal" : "text-zinc-400"
                }`}
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
    </article>
  );
}
