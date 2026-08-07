"use client";

import type { BracketRound } from "@prisma/client";
import { BracketGameCard } from "@/components/brackets/BracketGameCard";
import type { GameRow } from "@/components/brackets/bracket-types";
import { matchSortIndex } from "@/components/brackets/bracket-slot-lines";
import { chronologicalRoundColumns } from "@/lib/brackets/bracket-display";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";

const ACCENTS = [
  "border-emerald-300/90 bg-emerald-50/70",
  "border-amber-300/90 bg-amber-50/70",
  "border-rose-300/80 bg-rose-50/60",
] as const;

const HEADER_ACCENTS = [
  "bg-emerald-600 text-white",
  "bg-amber-500 text-white",
  "bg-rose-500 text-white",
] as const;

export function ChronologicalRoundBracket({
  rounds,
  byRound,
  timeZone,
}: {
  rounds: BracketRound[];
  byRound: Map<string, GameRow[]>;
  timeZone?: string | null;
}) {
  const gamesByRound = new Map<string, GameRow[]>();
  for (const [id, games] of byRound) {
    gamesByRound.set(
      id,
      [...games].sort((a, b) => matchSortIndex(a) - matchSortIndex(b)),
    );
  }

  const columns = chronologicalRoundColumns(rounds, gamesByRound);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-600">
        Games are grouped by schedule round (left → right), matching the workbook layout.
      </p>
      <div
        {...{ [DIVISION_SWIPE_IGNORE]: "" }}
        className="flex gap-3 overflow-x-auto pb-2"
        role="region"
        aria-label="Chronological double-elimination rounds"
      >
        {columns.map((col, ci) => {
          const accent = col.accentIndex % ACCENTS.length;
          return (
            <div
              key={`${col.label}-${ci}`}
              className={`flex min-h-[280px] w-[min(100%,240px)] shrink-0 flex-col overflow-hidden rounded-xl border ${ACCENTS[accent]}`}
            >
              <div className={`px-3 py-2 ${HEADER_ACCENTS[accent]}`}>
                <h3 className="text-xs font-bold uppercase tracking-[0.08em]">{col.label}</h3>
                {col.subtitle ? (
                  <p className="mt-0.5 text-[11px] font-medium opacity-90">{col.subtitle}</p>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col justify-around gap-3 px-3 py-3">
                {col.games.length === 0 ? (
                  <p className="text-sm text-zinc-500">Matchups TBA.</p>
                ) : (
                  col.games.map((g, mi) => (
                    <BracketGameCard
                      key={g.id}
                      game={g}
                      roundIndexDb={ci}
                      matchIndex={mi}
                      prevRoundName={ci > 0 ? columns[ci - 1]!.label : null}
                      timeZone={timeZone}
                      gLabelFallbackIndexZeroBased={
                        Number.isFinite(Number.parseInt(String(g.gameNumber ?? ""), 10))
                          ? Number.parseInt(String(g.gameNumber ?? ""), 10) - 1
                          : undefined
                      }
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
