"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BracketFormat, BracketRound, BracketRoundType } from "@prisma/client";
import { BracketGameCard } from "@/components/brackets/BracketGameCard";
import type { GameRow } from "@/components/brackets/bracket-types";
import { matchSortIndex } from "@/components/brackets/bracket-slot-lines";
import { chronologicalRoundColumns } from "@/lib/brackets/bracket-display";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import {
  bracketLoserTeamId,
  bracketLossCountsFromGames,
  bracketWinnerTeamId,
  eliminationLossLimit,
} from "@/lib/services/bracket-engine";

type WinnerEdge = {
  fromGameId: string;
  toGameId: string;
  slot: "home" | "away";
};

type DrawnPath = { d: string; dashed?: boolean };

const EST_CARD_H = 118;
const MIN_GAP = 36;
const BAND_GAP = 56;
const COL_PAD_Y = 12;
const HEADER_H = 48;
const JOIN_INSET = 28;
/** Raise each successive losers-lane column to show progression (G5 above G4, G7 above G5). */
const LOSERS_PROGRESSION_LIFT = 52;
const IF_NEC_FOOTER_H = 88;

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

function isIfNecessaryColumn(col: { subtitle?: string }): boolean {
  return (col.subtitle ?? "").toLowerCase().includes("if necessary");
}

function isChampionshipColumn(col: { subtitle?: string }): boolean {
  const s = (col.subtitle ?? "").toLowerCase();
  return s === "championship";
}

/**
 * Two-lane layout: winners on top, losers below with upward progression.
 * Singleton early winners (e.g. G1) are centered on the next winners column (G2/G3).
 */
function layoutGameTops(
  columns: { games: GameRow[]; subtitle?: string }[],
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

    perCol.forEach((games) => {
      if (games.length === 0) return;

      const tentative: { id: string; y: number }[] = [];
      for (const g of games) {
        const feeders = edges.filter((e) => e.toGameId === g.id);
        const feederCenters = feeders
          .map((e) => {
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
        } else {
          const prev = tentative[tentative.length - 1];
          y = prev ? prev.y + hOf(prev.id) + MIN_GAP : yOffset + COL_PAD_Y;
        }
        tentative.push({ id: g.id, y });
      }

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

  layoutBand(winnersByCol, 0);

  // Center a single winners-lane card on the vertical span of the next winners column (G1 ↔ G2/G3).
  for (let ci = 0; ci < winnersByCol.length - 1; ci++) {
    const cur = winnersByCol[ci]!;
    const next = winnersByCol[ci + 1]!;
    if (cur.length !== 1 || next.length < 2) continue;
    const centers = next
      .map((g) => {
        const ty = tops.get(g.id);
        return ty == null ? null : ty + hOf(g.id) / 2;
      })
      .filter((n): n is number => n != null);
    if (centers.length < 2) continue;
    const mid = (Math.min(...centers) + Math.max(...centers)) / 2;
    const g = cur[0]!;
    tops.set(g.id, mid - hOf(g.id) / 2);
  }

  // Recompute losers start from actual winners bottoms after centering
  let winnersMax = 0;
  for (const col of winnersByCol) {
    for (const g of col) {
      winnersMax = Math.max(winnersMax, (tops.get(g.id) ?? 0) + hOf(g.id));
    }
  }
  const losersBandStart = winnersMax + BAND_GAP;
  layoutBand(losersByCol, losersBandStart);

  // Staircase: each later losers column sits higher than the previous (progression).
  let losersColOrdinal = 0;
  for (const games of losersByCol) {
    if (games.length === 0) continue;
    if (losersColOrdinal > 0) {
      const lift = losersColOrdinal * LOSERS_PROGRESSION_LIFT;
      for (const g of games) {
        const y = tops.get(g.id);
        if (y != null) tops.set(g.id, Math.max(COL_PAD_Y, y - lift));
      }
    }
    losersColOrdinal += 1;
  }

  // Championship + if-necessary: same horizon (align GF2 to GF1).
  const champCol = columns.findIndex((c) => isChampionshipColumn(c));
  const ifNecCol = columns.findIndex((c) => isIfNecessaryColumn(c));
  if (champCol >= 0 && ifNecCol >= 0) {
    const gf1Game = sortColumnGames(columns[champCol]!.games)[0];
    const gf2Game = sortColumnGames(columns[ifNecCol]!.games)[0];
    if (gf1Game && gf2Game) {
      const y1 = tops.get(gf1Game.id);
      if (y1 != null) tops.set(gf2Game.id, y1);
    }
  }

  return tops;
}

function boardContentHeight(
  allGames: GameRow[],
  tops: Map<string, number>,
  heights: Map<string, number>,
  extraFooter: number,
): number {
  let max = 200;
  for (const g of allGames) {
    const y = tops.get(g.id) ?? 0;
    const h = heights.get(g.id) ?? EST_CARD_H;
    max = Math.max(max, y + h + COL_PAD_Y);
  }
  return max + extraFooter;
}

type SourcePt = { x1: number; y1: number };

function buildJoinPaths(edges: WinnerEdge[], board: HTMLElement): DrawnPath[] {
  const c = board.getBoundingClientRect();
  const byTarget = new Map<string, WinnerEdge[]>();
  for (const edge of edges) {
    const list = byTarget.get(edge.toGameId) ?? [];
    list.push(edge);
    byTarget.set(edge.toGameId, list);
  }

  const paths: DrawnPath[] = [];

  for (const [toGameId, group] of byTarget) {
    const toEl = board.querySelector<HTMLElement>(`[data-bracket-game-id="${toGameId}"]`);
    if (!toEl) continue;
    const t = toEl.getBoundingClientRect();
    if (t.width < 2) continue;

    const x2 = t.left - c.left;
    const meetY = t.top + t.height / 2 - c.top;

    const sources: SourcePt[] = [];
    for (const edge of group) {
      const fromEl = board.querySelector<HTMLElement>(
        `[data-bracket-game-id="${edge.fromGameId}"]`,
      );
      if (!fromEl) continue;
      const f = fromEl.getBoundingClientRect();
      if (f.width < 2) continue;
      sources.push({
        x1: f.right - c.left,
        y1: f.top + f.height / 2 - c.top,
      });
    }
    if (sources.length === 0) continue;

    const maxSourceRight = Math.max(...sources.map((s) => s.x1));
    const joinX = Math.min(x2 - 12, Math.max(maxSourceRight + 16, x2 - JOIN_INSET));

    if (sources.length === 1) {
      const s = sources[0]!;
      paths.push({ d: `M ${s.x1} ${s.y1} H ${joinX} V ${meetY} H ${x2}` });
      continue;
    }

    for (const s of sources) {
      paths.push({ d: `M ${s.x1} ${s.y1} H ${joinX}` });
    }
    const yMin = Math.min(...sources.map((s) => s.y1), meetY);
    const yMax = Math.max(...sources.map((s) => s.y1), meetY);
    paths.push({ d: `M ${joinX} ${yMin} V ${yMax}` });
    paths.push({ d: `M ${joinX} ${meetY} H ${x2}` });
  }

  return paths;
}

function buildIfNecessaryDashedPath(
  gf1Id: string,
  gf2Id: string,
  board: HTMLElement,
): DrawnPath | null {
  const c = board.getBoundingClientRect();
  const fromEl = board.querySelector<HTMLElement>(`[data-bracket-game-id="${gf1Id}"]`);
  const toEl = board.querySelector<HTMLElement>(`[data-bracket-game-id="${gf2Id}"]`);
  if (!fromEl || !toEl) return null;
  const f = fromEl.getBoundingClientRect();
  const t = toEl.getBoundingClientRect();
  if (f.width < 2 || t.width < 2) return null;
  const x1 = f.right - c.left;
  const y1 = f.top + f.height / 2 - c.top;
  const x2 = t.left - c.left;
  const y2 = t.top + t.height / 2 - c.top;
  // Same horizon → straight dashed connector
  return { d: `M ${x1} ${y1} H ${x2}`, dashed: true };
}

type IfNecUi = {
  shaded: boolean;
  footer: string;
  winnerName: string | null;
};

function resolveIfNecessaryUi(
  gf1: GameRow | undefined,
  allGames: GameRow[],
  format: BracketFormat | string,
): IfNecUi {
  const pendingFooter =
    "G9 is only required if the Loser of G8 was their first loss of the COBA playdowns otherwise the tournament ends at Round 6";

  if (!gf1 || gf1.status !== "FINAL") {
    return { shaded: false, footer: pendingFooter, winnerName: null };
  }

  const loserId = bracketLoserTeamId(gf1);
  const winnerId = bracketWinnerTeamId(gf1);
  const winnerName =
    winnerId == null
      ? null
      : gf1.homeTeamId === winnerId
        ? (gf1.homeTeam?.name ?? null)
        : gf1.awayTeamId === winnerId
          ? (gf1.awayTeam?.name ?? null)
          : null;

  if (!loserId) {
    return { shaded: false, footer: pendingFooter, winnerName };
  }

  const losses = bracketLossCountsFromGames(allGames);
  const loserLosses = losses.get(loserId) ?? 0;
  const limit = eliminationLossLimit(format);

  if (loserLosses >= limit) {
    return {
      shaded: true,
      footer: winnerName
        ? `Round 7 is not required, congratulations to ${winnerName}!`
        : "Round 7 is not required.",
      winnerName,
    };
  }

  return {
    shaded: false,
    footer:
      "G9 is required — both remaining teams have one loss. Play the if-necessary championship.",
    winnerName,
  };
}

export function ChronologicalRoundBracket({
  rounds,
  byRound,
  timeZone,
  format = "DOUBLE_ELIMINATION",
}: {
  rounds: BracketRound[];
  byRound: Map<string, GameRow[]>;
  timeZone?: string | null;
  format?: BracketFormat | string;
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

  const champColIdx = columns.findIndex((c) => isChampionshipColumn(c));
  const ifNecColIdx = columns.findIndex((c) => isIfNecessaryColumn(c));
  const gf1 = champColIdx >= 0 ? sortColumnGames(columns[champColIdx]!.games)[0] : undefined;
  const gf2 = ifNecColIdx >= 0 ? sortColumnGames(columns[ifNecColIdx]!.games)[0] : undefined;

  const ifNecUi = useMemo(
    () => resolveIfNecessaryUi(gf1, allGames, format),
    [gf1, allGames, format],
  );

  const tops = useMemo(
    () => layoutGameTops(columns, winnerEdges, heights),
    [columns, winnerEdges, heights],
  );

  const contentH = useMemo(
    () =>
      boardContentHeight(
        allGames,
        tops,
        heights,
        ifNecColIdx >= 0 ? IF_NEC_FOOTER_H : 0,
      ),
    [allGames, tops, heights, ifNecColIdx],
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
      const next = buildJoinPaths(winnerEdges, board);
      if (gf1 && gf2 && !ifNecUi.shaded) {
        const dashed = buildIfNecessaryDashedPath(gf1.id, gf2.id, board);
        if (dashed) next.push(dashed);
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
  }, [allGames, winnerEdges, heights, tops, contentH, gf1, gf2, ifNecUi.shaded]);

  const columnShellH = contentH + HEADER_H;

  return (
    <div
      {...{ [DIVISION_SWIPE_IGNORE]: "" }}
      className="overflow-x-auto pb-2"
      role="region"
      aria-label="Chronological double-elimination rounds"
    >
      <div
        ref={boardRef}
        className="relative flex w-max min-w-full items-stretch gap-10"
        style={{ minHeight: columnShellH }}
      >
        {columns.map((col, ci) => {
          const games = sortColumnGames(col.games);
          const isIfNec = isIfNecessaryColumn(col);
          const shade = isIfNec && ifNecUi.shaded;
          return (
            <div
              key={`${col.label}-${ci}`}
              className={`relative z-0 flex w-[min(100%,240px)] shrink-0 flex-col overflow-hidden rounded-xl border ${
                shade
                  ? "border-zinc-200 bg-zinc-100/90 opacity-55"
                  : "border-zinc-200 bg-zinc-50/80"
              }`}
              style={{ height: columnShellH }}
            >
              <div className="shrink-0 border-b border-zinc-200 bg-white px-3 py-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-royal">
                  {col.label}
                </h3>
                {col.subtitle ? (
                  <p className="mt-0.5 text-[11px] font-medium text-zinc-600">{col.subtitle}</p>
                ) : null}
              </div>
              <div className="relative flex-1 px-3" style={{ height: contentH }}>
                {games.length === 0 ? (
                  <p className="pt-4 text-sm text-zinc-500">Matchups TBA.</p>
                ) : (
                  games.map((g, mi) => (
                    <div
                      key={g.id}
                      data-bracket-game-id={g.id}
                      className={`absolute left-3 right-3 z-20 ${shade ? "pointer-events-none" : ""}`}
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
                      {isIfNec ? (
                        <p
                          className={`mt-2 text-left text-[11px] leading-snug ${
                            shade ? "font-semibold text-zinc-700" : "text-zinc-500"
                          }`}
                        >
                          {ifNecUi.footer}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        <svg
          className="pointer-events-none absolute left-0 top-0 z-10 overflow-visible"
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
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeDasharray={p.dashed ? "6 5" : undefined}
              opacity={p.dashed ? 0.75 : 0.95}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
