"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BracketRound, BracketRoundType } from "@prisma/client";
import { BracketGameCard } from "@/components/brackets/BracketGameCard";
import type { GameRow } from "@/components/brackets/bracket-types";
import { matchSortIndex } from "@/components/brackets/bracket-slot-lines";
import { chronologicalRoundColumns } from "@/lib/brackets/bracket-display";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";

type WinnerEdge = {
  fromGameId: string;
  toGameId: string;
  slot: "home" | "away";
};

type DrawnPath = { d: string };

const EST_CARD_H = 118;
const MIN_GAP = 36;
const BAND_GAP = 56;
const COL_PAD_Y = 12;

/**
 * Lane from feeders (not BracketRound.roundType): OBA packs mixed W/L games into one
 * schedule round (e.g. R4 has G5 losers + G6 winners under one round row).
 */
function isLosersLaneGame(g: GameRow): boolean {
  const bm = g.bracketMatch;
  if (!bm) {
    const t = g.bracketRound?.roundType as BracketRoundType | null | undefined;
    return t === "LOSERS" || t === "LOSERS_SECOND";
  }
  return bm.homeFromKind === "LOSER" || bm.awayFromKind === "LOSER";
}

function collectWinnerEdges(games: GameRow[]): WinnerEdge[] {
  const edges: WinnerEdge[] = [];
  for (const g of games) {
    const bm = g.bracketMatch;
    if (!bm) continue;
    if (bm.awayFromMatch?.game?.id && bm.awayFromKind === "WINNER") {
      edges.push({
        fromGameId: bm.awayFromMatch.game.id,
        toGameId: g.id,
        slot: "away",
      });
    }
    if (bm.homeFromMatch?.game?.id && bm.homeFromKind === "WINNER") {
      edges.push({
        fromGameId: bm.homeFromMatch.game.id,
        toGameId: g.id,
        slot: "home",
      });
    }
  }
  return edges;
}

function sortColumnGames(games: GameRow[]): GameRow[] {
  return [...games].sort((a, b) => {
    const aL = isLosersLaneGame(a) ? 1 : 0;
    const bL = isLosersLaneGame(b) ? 1 : 0;
    if (aL !== bL) return aL - bL;
    const na = Number.parseInt(String(a.gameNumber ?? ""), 10);
    const nb = Number.parseInt(String(b.gameNumber ?? ""), 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return matchSortIndex(a) - matchSortIndex(b);
  });
}

/**
 * Two-lane layout: winners on top, losers below.
 * Join games sit between their winner-feeders within the same lane.
 */
function layoutGameTops(
  columns: { games: GameRow[] }[],
  edges: WinnerEdge[],
  heights: Map<string, number>,
): Map<string, number> {
  const tops = new Map<string, number>();
  const hOf = (id: string) => heights.get(id) ?? EST_CARD_H;

  const winnersByCol = columns.map((col) =>
    sortColumnGames(col.games).filter((g) => !isLosersLaneGame(g)),
  );
  const losersByCol = columns.map((col) =>
    sortColumnGames(col.games).filter((g) => isLosersLaneGame(g)),
  );
  const losersIds = new Set(losersByCol.flat().map((g) => g.id));

  const layoutBand = (perCol: GameRow[][], yOffset: number): number => {
    let bandBottom = yOffset;

    perCol.forEach((games, ci) => {
      if (games.length === 0) return;

      const tentative: { id: string; y: number }[] = [];
      for (const g of games) {
        const feeders = edges.filter((e) => e.toGameId === g.id);
        const feederCenters = feeders
          .map((e) => {
            // Only use same-band feeders for vertical centering.
            const fromLosers = losersIds.has(e.fromGameId);
            const toLosers = losersIds.has(g.id);
            if (fromLosers !== toLosers) return null;
            const ty = tops.get(e.fromGameId);
            if (ty == null) return null;
            return ty + hOf(e.fromGameId) / 2;
          })
          .filter((n): n is number => n != null);

        let y: number;
        if (feeders.length > 0 && feederCenters.length > 0) {
          const avg = feederCenters.reduce((a, b) => a + b, 0) / feederCenters.length;
          y = avg - hOf(g.id) / 2;
        } else if (ci === 0 || feederCenters.length === 0) {
          const prev = tentative[tentative.length - 1];
          y = prev ? prev.y + hOf(prev.id) + MIN_GAP : yOffset + COL_PAD_Y;
        } else {
          const prev = tentative[tentative.length - 1];
          y = prev ? prev.y + hOf(prev.id) + MIN_GAP : yOffset + COL_PAD_Y;
        }
        tentative.push({ id: g.id, y });
      }

      // Preserve game-number order; only push down to clear overlaps.
      for (let i = 0; i < tentative.length; i++) {
        const cur = tentative[i]!;
        if (i === 0) {
          cur.y = Math.max(yOffset + COL_PAD_Y, cur.y);
        } else {
          const prev = tentative[i - 1]!;
          const minY = prev.y + hOf(prev.id) + MIN_GAP;
          if (cur.y < minY) cur.y = minY;
        }
        tops.set(cur.id, cur.y);
        bandBottom = Math.max(bandBottom, cur.y + hOf(cur.id));
      }
    });

    return bandBottom;
  };

  const winnersBottom = layoutBand(winnersByCol, 0);
  const losersStart = winnersBottom + BAND_GAP;
  layoutBand(losersByCol, losersStart);

  return tops;
}

function columnContentHeight(
  games: GameRow[],
  tops: Map<string, number>,
  heights: Map<string, number>,
): number {
  let max = 200;
  for (const g of games) {
    const y = tops.get(g.id) ?? 0;
    const h = heights.get(g.id) ?? EST_CARD_H;
    max = Math.max(max, y + h + COL_PAD_Y);
  }
  return max;
}

/**
 * Orthogonal route that travels at the source card's Y until the target gutter,
 * then drops/rises into the seat — so skip-round winners stay in the winners lane
 * instead of cutting through a losers card in an intermediate column.
 */
function pathForEdge(
  fromEl: HTMLElement,
  toEl: HTMLElement,
  board: HTMLElement,
  slot: "home" | "away",
  railIndex: number,
): DrawnPath | null {
  const c = board.getBoundingClientRect();
  const f = fromEl.getBoundingClientRect();
  const t = toEl.getBoundingClientRect();
  if (f.width < 2 || t.width < 2) return null;

  const x1 = f.right - c.left;
  const y1 = f.top + f.height / 2 - c.top;
  const x2 = t.left - c.left;
  const y2 = t.top + t.height * (slot === "away" ? 0.36 : 0.7) - c.top;

  const span = Math.max(24, x2 - x1);
  // Enter the target gutter late so long skip-round runs stay horizontal at y1.
  const railT = 0.72 + (railIndex % 3) * 0.06;
  const midX = x1 + span * Math.min(0.92, railT);

  return {
    d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
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
  const [heights, setHeights] = useState<Map<string, number>>(() => new Map());

  const gamesByRound = useMemo(() => {
    const map = new Map<string, GameRow[]>();
    for (const [id, games] of byRound) {
      map.set(id, sortColumnGames(games));
    }
    return map;
  }, [byRound]);

  const columns = useMemo(
    () => chronologicalRoundColumns(rounds, gamesByRound),
    [rounds, gamesByRound],
  );

  const allGames = useMemo(() => columns.flatMap((col) => col.games), [columns]);
  const winnerEdges = useMemo(() => collectWinnerEdges(allGames), [allGames]);

  const tops = useMemo(
    () => layoutGameTops(columns, winnerEdges, heights),
    [columns, winnerEdges, heights],
  );

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const measureAndDraw = () => {
      const nextHeights = new Map<string, number>();
      for (const g of allGames) {
        const el = board.querySelector<HTMLElement>(`[data-bracket-game-id="${g.id}"]`);
        if (el) nextHeights.set(g.id, el.offsetHeight);
      }
      let heightsChanged = nextHeights.size !== heights.size;
      if (!heightsChanged) {
        for (const [id, h] of nextHeights) {
          if (heights.get(id) !== h) {
            heightsChanged = true;
            break;
          }
        }
      }
      if (heightsChanged) {
        setHeights(nextHeights);
        return;
      }

      setBoardSize({ w: board.scrollWidth, h: board.scrollHeight });
      const next: DrawnPath[] = [];
      const railByTarget = new Map<string, number>();
      for (const edge of winnerEdges) {
        const fromEl = board.querySelector<HTMLElement>(
          `[data-bracket-game-id="${edge.fromGameId}"]`,
        );
        const toEl = board.querySelector<HTMLElement>(
          `[data-bracket-game-id="${edge.toGameId}"]`,
        );
        if (!fromEl || !toEl) continue;
        const railIndex = railByTarget.get(edge.toGameId) ?? 0;
        railByTarget.set(edge.toGameId, railIndex + 1);
        const drawn = pathForEdge(fromEl, toEl, board, edge.slot, railIndex);
        if (drawn) next.push(drawn);
      }
      setPaths(next);
    };

    measureAndDraw();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureAndDraw) : null;
    ro?.observe(board);
    window.addEventListener("resize", measureAndDraw);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measureAndDraw);
    };
  }, [allGames, winnerEdges, heights, tops]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-600">
        Games are grouped by schedule round (left → right). Winners stay on the upper path; losers
        games sit below. Lines show where winners advance.
      </p>
      <div
        {...{ [DIVISION_SWIPE_IGNORE]: "" }}
        className="overflow-x-auto pb-2"
        role="region"
        aria-label="Chronological double-elimination rounds"
      >
        <div ref={boardRef} className="relative flex w-max min-w-full items-start gap-10">
          <svg
            className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
            width={boardSize.w || undefined}
            height={boardSize.h || undefined}
            aria-hidden
          >
            {paths.map((p, i) => (
              <path
                key={`${p.d}-${i}`}
                d={p.d}
                fill="none"
                stroke="#334155"
                strokeWidth={1.75}
                opacity={0.9}
              />
            ))}
          </svg>

          {columns.map((col, ci) => {
            const games = sortColumnGames(col.games);
            const contentH = columnContentHeight(games, tops, heights);
            return (
              <div
                key={`${col.label}-${ci}`}
                className="relative z-10 w-[min(100%,240px)] shrink-0 overflow-visible rounded-xl border border-zinc-200 bg-zinc-50/80"
                style={{ minHeight: contentH + 44 }}
              >
                <div className="border-b border-zinc-200 bg-white px-3 py-2">
                  <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-royal">
                    {col.label}
                  </h3>
                  {col.subtitle ? (
                    <p className="mt-0.5 text-[11px] font-medium text-zinc-600">{col.subtitle}</p>
                  ) : null}
                </div>
                <div className="relative px-3" style={{ height: contentH }}>
                  {games.length === 0 ? (
                    <p className="pt-4 text-sm text-zinc-500">Matchups TBA.</p>
                  ) : (
                    games.map((g, mi) => (
                      <div
                        key={g.id}
                        data-bracket-game-id={g.id}
                        className="absolute left-3 right-3"
                        style={{ top: tops.get(g.id) ?? COL_PAD_Y }}
                      >
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
