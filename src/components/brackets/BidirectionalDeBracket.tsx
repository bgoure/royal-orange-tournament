"use client";

import type { BracketRound } from "@prisma/client";
import { BracketGameCard } from "@/components/brackets/BracketGameCard";
import type { GameRow } from "@/components/brackets/bracket-types";
import { matchSortIndex } from "@/components/brackets/bracket-slot-lines";
import {
  bidirectionalDeLayout,
  roundTypeShortLabel,
} from "@/lib/brackets/bracket-display";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";

function RoundColumn({
  round,
  games,
  timeZone,
  side,
}: {
  round: BracketRound;
  games: GameRow[];
  timeZone?: string | null;
  side: "left" | "center" | "right";
}) {
  const sorted = [...games].sort((a, b) => matchSortIndex(a) - matchSortIndex(b));
  const border =
    side === "center"
      ? "border-royal/40 bg-royal-50/40"
      : side === "left"
        ? "border-amber-200/80 bg-amber-50/30"
        : "border-emerald-200/80 bg-emerald-50/30";

  return (
    <div
      className={`flex min-h-[280px] w-[min(100%,240px)] shrink-0 flex-col rounded-xl border px-3 py-3 ${border}`}
    >
      <div className="mb-3 shrink-0">
        <h3 className="border-b border-zinc-200 pb-1 text-xs font-bold uppercase tracking-[0.06em] text-royal">
          {round.name}
        </h3>
        <p className="mt-1 text-[11px] font-medium text-zinc-600">
          {side === "left"
            ? "← Losers"
            : side === "center"
              ? "Round 1 · start"
              : round.roundType === "FINAL"
                ? "Grand final →"
                : "Winners →"}
          {" · "}
          {roundTypeShortLabel(round.roundType)}
        </p>
      </div>
      <div className="flex flex-1 flex-col justify-around gap-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-zinc-500">Matchups TBA.</p>
        ) : (
          sorted.map((g, mi) => (
            <BracketGameCard
              key={g.id}
              game={g}
              roundIndexDb={round.roundIndex}
              matchIndex={mi}
              prevRoundName={null}
              timeZone={timeZone}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function BidirectionalDeBracket({
  rounds,
  byRound,
  timeZone,
}: {
  rounds: BracketRound[];
  byRound: Map<string, GameRow[]>;
  timeZone?: string | null;
}) {
  const layout = bidirectionalDeLayout(rounds);

  return (
    <div className="flex flex-col gap-3">
      <div
        {...{ [DIVISION_SWIPE_IGNORE]: "" }}
        className="flex gap-2 overflow-x-auto pb-2"
        role="region"
        aria-label="Bidirectional double-elimination bracket"
      >
        {layout.left.map((r) => (
          <RoundColumn
            key={r.id}
            round={r}
            games={byRound.get(r.id) ?? []}
            timeZone={timeZone}
            side="left"
          />
        ))}
        {layout.center ? (
          <RoundColumn
            round={layout.center}
            games={byRound.get(layout.center.id) ?? []}
            timeZone={timeZone}
            side="center"
          />
        ) : null}
        {layout.right.map((r) => (
          <RoundColumn
            key={r.id}
            round={r}
            games={byRound.get(r.id) ?? []}
            timeZone={timeZone}
            side="right"
          />
        ))}
      </div>
    </div>
  );
}
