"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BracketRound } from "@prisma/client";
import { BracketGameCard } from "@/components/brackets/BracketGameCard";
import type { GameRow } from "@/components/brackets/bracket-types";
import { matchSortIndex } from "@/components/brackets/bracket-slot-lines";
import { chronologicalRoundColumns } from "@/lib/brackets/bracket-display";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";

type FeederEdge = {
  fromGameId: string;
  toGameId: string;
  kind: "WINNER" | "LOSER";
  slot: "home" | "away";
};

type DrawnPath = {
  d: string;
  kind: "WINNER" | "LOSER";
  labelX: number;
  labelY: number;
};

function collectFeederEdges(games: GameRow[]): FeederEdge[] {
  const edges: FeederEdge[] = [];
  for (const g of games) {
    const bm = g.bracketMatch;
    if (!bm) continue;
    if (bm.awayFromMatch?.game?.id && bm.awayFromKind) {
      edges.push({
        fromGameId: bm.awayFromMatch.game.id,
        toGameId: g.id,
        kind: bm.awayFromKind,
        slot: "away",
      });
    }
    if (bm.homeFromMatch?.game?.id && bm.homeFromKind) {
      edges.push({
        fromGameId: bm.homeFromMatch.game.id,
        toGameId: g.id,
        kind: bm.homeFromKind,
        slot: "home",
      });
    }
  }
  return edges;
}

function pathForEdge(
  fromEl: HTMLElement,
  toEl: HTMLElement,
  board: HTMLElement,
  slot: "home" | "away",
  kind: "WINNER" | "LOSER",
): DrawnPath | null {
  const c = board.getBoundingClientRect();
  const f = fromEl.getBoundingClientRect();
  const t = toEl.getBoundingClientRect();
  if (f.width < 2 || t.width < 2) return null;

  const x1 = f.right - c.left;
  const y1 = f.top + f.height / 2 - c.top;
  const x2 = t.left - c.left;
  const y2 = t.top + t.height * (slot === "away" ? 0.32 : 0.68) - c.top;
  const midX = x1 + Math.max(14, (x2 - x1) * 0.45);
  return {
    d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
    kind,
    labelX: midX,
    labelY: (y1 + y2) / 2,
  };
}

export function ChronologicalRoundBracket({
  rounds,
  byRound,
  timeZone,
}: {
  rounds: BracketRound[];
  byRound: Map<string, GameRow[]>;
  timeZone?: string | null;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<DrawnPath[]>([]);
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 });

  const gamesByRound = useMemo(() => {
    const map = new Map<string, GameRow[]>();
    for (const [id, games] of byRound) {
      map.set(
        id,
        [...games].sort((a, b) => matchSortIndex(a) - matchSortIndex(b)),
      );
    }
    return map;
  }, [byRound]);

  const columns = useMemo(
    () => chronologicalRoundColumns(rounds, gamesByRound),
    [rounds, gamesByRound],
  );

  const allGames = useMemo(() => columns.flatMap((col) => col.games), [columns]);
  const edges = useMemo(() => collectFeederEdges(allGames), [allGames]);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const redraw = () => {
      setBoardSize({ w: board.scrollWidth, h: board.scrollHeight });
      const next: DrawnPath[] = [];
      for (const edge of edges) {
        const fromEl = board.querySelector<HTMLElement>(
          `[data-bracket-game-id="${edge.fromGameId}"]`,
        );
        const toEl = board.querySelector<HTMLElement>(
          `[data-bracket-game-id="${edge.toGameId}"]`,
        );
        if (!fromEl || !toEl) continue;
        const drawn = pathForEdge(fromEl, toEl, board, edge.slot, edge.kind);
        if (drawn) next.push(drawn);
      }
      setPaths(next);
    };

    redraw();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(redraw) : null;
    ro?.observe(board);
    window.addEventListener("resize", redraw);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", redraw);
    };
  }, [edges, columns]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-600">
        Games are grouped by schedule round (left → right). Lines show where winners (solid) and
        losers (dashed) advance.
      </p>
      <div
        {...{ [DIVISION_SWIPE_IGNORE]: "" }}
        className="overflow-x-auto pb-2"
        role="region"
        aria-label="Chronological double-elimination rounds"
      >
        <div ref={boardRef} className="relative flex w-max min-w-full gap-8">
          <svg
            className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
            width={boardSize.w || undefined}
            height={boardSize.h || undefined}
            aria-hidden
          >
            {paths.map((p, i) => (
              <g key={`${p.d}-${i}`}>
                <path
                  d={p.d}
                  fill="none"
                  stroke={p.kind === "LOSER" ? "#b45309" : "#334155"}
                  strokeWidth={1.75}
                  strokeDasharray={p.kind === "LOSER" ? "5 4" : undefined}
                  opacity={0.85}
                />
                <circle
                  cx={p.labelX}
                  cy={p.labelY}
                  r={8}
                  fill={p.kind === "LOSER" ? "#fff7ed" : "#f8fafc"}
                  stroke={p.kind === "LOSER" ? "#b45309" : "#334155"}
                  strokeWidth={1}
                />
                <text
                  x={p.labelX}
                  y={p.labelY + 3.5}
                  textAnchor="middle"
                  className="fill-zinc-700"
                  style={{ fontSize: 9, fontWeight: 700 }}
                >
                  {p.kind === "LOSER" ? "L" : "W"}
                </text>
              </g>
            ))}
          </svg>

          {columns.map((col, ci) => (
            <div
              key={`${col.label}-${ci}`}
              className="relative z-10 flex min-h-[280px] w-[min(100%,240px)] shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80"
            >
              <div className="border-b border-zinc-200 bg-white px-3 py-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-royal">
                  {col.label}
                </h3>
                {col.subtitle ? (
                  <p className="mt-0.5 text-[11px] font-medium text-zinc-600">{col.subtitle}</p>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col justify-around gap-6 px-3 py-4">
                {col.games.length === 0 ? (
                  <p className="text-sm text-zinc-500">Matchups TBA.</p>
                ) : (
                  col.games.map((g, mi) => (
                    <div key={g.id} data-bracket-game-id={g.id} className="relative">
                      <BracketGameCard
                        game={g}
                        roundIndexDb={g.bracketRound?.roundIndex ?? ci}
                        matchIndex={mi}
                        prevRoundName={null}
                        timeZone={timeZone}
                        gLabelFallbackIndexZeroBased={
                          Number.isFinite(Number.parseInt(String(g.gameNumber ?? ""), 10))
                            ? Number.parseInt(String(g.gameNumber ?? ""), 10) - 1
                            : undefined
                        }
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
