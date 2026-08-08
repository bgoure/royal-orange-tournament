"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BracketFormat, BracketRound, BracketRoundType } from "@prisma/client";
import { BracketGameCard } from "@/components/brackets/BracketGameCard";
import type { GameRow } from "@/components/brackets/bracket-types";
import { matchSortIndex } from "@/components/brackets/bracket-slot-lines";
import {
  BRACKET_COL_DEFAULT_PX,
  BRACKET_ROUND_COLUMN_CLASS,
  bracketColumnWidthForLongestWord,
  longestWordWidthPx,
} from "@/components/brackets/bracket-card-layout";
import { chronologicalRoundColumns } from "@/lib/brackets/bracket-display";
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
/** Raise each successive losers-lane column to show progression (G5 above G4, G9 above G7). */
const LOSERS_PROGRESSION_LIFT = 52;
/** Extra rise for the first losers-lane card (e.g. G4 under G3). */
const LOSERS_FIRST_CARD_LIFT = 40;
const IF_NEC_FOOTER_H = 88;

/**
 * Lane from feeders (not BracketRound.roundType): OBA packs mixed W/L games into one
 * schedule round (e.g. R4 has G5 losers + G6 winners under one round row).
 * Also treats "winners of losers" games (e.g. G7: W5 vs W6) as losers-lane.
 */
function isLosersLaneGame(g: GameRow, byGameId: Map<string, GameRow>, seen = new Set<string>()): boolean {
  if (seen.has(g.id)) return false;
  seen.add(g.id);
  const bm = g.bracketMatch;
  if (!bm) {
    const t = g.bracketRound?.roundType as BracketRoundType | null | undefined;
    return t === "LOSERS" || t === "LOSERS_SECOND";
  }
  if (bm.homeFromKind === "LOSER" || bm.awayFromKind === "LOSER") return true;
  if (bm.homeFromKind === "WINNER" && bm.awayFromKind === "WINNER") {
    const homeSrc = bm.homeFromMatch?.game?.id ? byGameId.get(bm.homeFromMatch.game.id) : null;
    const awaySrc = bm.awayFromMatch?.game?.id ? byGameId.get(bm.awayFromMatch.game.id) : null;
    if (
      homeSrc &&
      awaySrc &&
      isLosersLaneGame(homeSrc, byGameId, seen) &&
      isLosersLaneGame(awaySrc, byGameId, seen)
    ) {
      return true;
    }
  }
  return false;
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

function gameIdMap(games: Iterable<GameRow>): Map<string, GameRow> {
  const m = new Map<string, GameRow>();
  for (const g of games) m.set(g.id, g);
  return m;
}

function sortColumnGames(games: GameRow[], byGameId: Map<string, GameRow>): GameRow[] {
  return [...games].sort((a, b) => {
    const aL = isLosersLaneGame(a, byGameId) ? 1 : 0;
    const bL = isLosersLaneGame(b, byGameId) ? 1 : 0;
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

function gameByNumber(games: GameRow[], num: string): GameRow | undefined {
  for (const g of games) {
    if ((g.gameNumber?.trim() ?? "") === num) return g;
  }
  return undefined;
}

/** Sit `midNum` vertically between `aNum` and `bNum` (e.g. G7 between G5 and G6). */
function centerBetweenGameNumbers(
  games: GameRow[],
  tops: Map<string, number>,
  hOf: (id: string) => number,
  midNum: string,
  aNum: string,
  bNum: string,
  laneIds?: Set<string>,
): void {
  const mid = gameByNumber(games, midNum);
  const a = gameByNumber(games, aNum);
  const b = gameByNumber(games, bNum);
  if (!mid || !a || !b) return;
  if (laneIds && (!laneIds.has(mid.id) || !laneIds.has(a.id) || !laneIds.has(b.id))) return;
  const ya = tops.get(a.id);
  const yb = tops.get(b.id);
  if (ya == null || yb == null) return;
  const midCenter = (ya + hOf(a.id) / 2 + yb + hOf(b.id) / 2) / 2;
  tops.set(mid.id, midCenter - hOf(mid.id) / 2);
}

/**
 * Snap games that have exactly one same-lane WINNER feeder onto that feeder's
 * vertical center (e.g. G3 with G1, G4 with G2) so join lines stay straight.
 * When `minFeederOrdinal` is set, skip feeders in earlier losers columns so the first
 * losers card (G4) can sit higher without pulling later games down onto it.
 */
function snapSingleWinnerFeederRows(
  perCol: GameRow[][],
  edges: WinnerEdge[],
  tops: Map<string, number>,
  hOf: (id: string) => number,
  laneIds: Set<string>,
  minFeederOrdinal = 0,
): void {
  const ordinalById = new Map<string, number>();
  let ord = 0;
  for (const games of perCol) {
    if (games.length === 0) continue;
    for (const g of games) ordinalById.set(g.id, ord);
    ord += 1;
  }

  for (const games of perCol) {
    for (const g of games) {
      const feeders = edges.filter(
        (e) => e.toGameId === g.id && laneIds.has(e.fromGameId) && laneIds.has(g.id),
      );
      if (feeders.length !== 1) continue;
      const fromId = feeders[0]!.fromGameId;
      if ((ordinalById.get(fromId) ?? 0) < minFeederOrdinal) continue;
      const fromY = tops.get(fromId);
      if (fromY == null) continue;
      tops.set(g.id, fromY + hOf(fromId) / 2 - hOf(g.id) / 2);
    }
  }
}

/**
 * Two-lane layout: winners on top, losers below with upward progression.
 * Single winner-feeder chains share a horizontal center line (G1↔G3) even when
 * card heights differ. G7 centers between G5/G6; G9 between G10 and G5.
 */
function layoutGameTops(
  columns: { games: GameRow[]; subtitle?: string }[],
  edges: WinnerEdge[],
  heights: Map<string, number>,
): Map<string, number> {
  const tops = new Map<string, number>();
  const hOf = (id: string) => heights.get(id) ?? EST_CARD_H;
  const byGameId = gameIdMap(columns.flatMap((c) => c.games));

  const winnersByCol = columns.map((col) =>
    sortColumnGames(col.games, byGameId).filter((g) => !isLosersLaneGame(g, byGameId)),
  );
  const losersByCol = columns.map((col) =>
    sortColumnGames(col.games, byGameId).filter((g) => isLosersLaneGame(g, byGameId)),
  );
  const winnersIds = new Set(winnersByCol.flat().map((g) => g.id));
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
        const sameLaneFeeders = feeders.filter((e) => {
          const fromLosers = losersIds.has(e.fromGameId);
          const toLosers = losersIds.has(g.id);
          return fromLosers === toLosers && tops.has(e.fromGameId);
        });
        if (sameLaneFeeders.length === 1) {
          // Match vertical centers with the sole feeder (straight connector).
          const fromId = sameLaneFeeders[0]!.fromGameId;
          y = tops.get(fromId)! + hOf(fromId) / 2 - hOf(g.id) / 2;
        } else if (feederCenters.length > 0) {
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
          // Do not clamp single-feeder snaps upward into a lower band offset.
          const sole = edges.filter((e) => {
            if (e.toGameId !== cur.id) return false;
            const fromLosers = losersIds.has(e.fromGameId);
            const toLosers = losersIds.has(cur.id);
            return fromLosers === toLosers && tops.has(e.fromGameId);
          });
          if (sole.length === 1) {
            const fromId = sole[0]!.fromGameId;
            cur.y = tops.get(fromId)! + hOf(fromId) / 2 - hOf(cur.id) / 2;
          } else {
            cur.y = Math.max(yOffset + COL_PAD_Y, cur.y);
          }
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
  // Reinforce single-feeder winners chains after band layout — center-aligned
  // (6-team G1→G3 / G2→G4; 7-team G1→G5; etc.).
  snapSingleWinnerFeederRows(winnersByCol, edges, tops, hOf, winnersIds);

  // Recompute losers start from actual winners bottoms after snap
  let winnersMax = 0;
  for (const col of winnersByCol) {
    for (const g of col) {
      winnersMax = Math.max(winnersMax, (tops.get(g.id) ?? 0) + hOf(g.id));
    }
  }
  const losersBandStart = winnersMax + BAND_GAP;
  layoutBand(losersByCol, losersBandStart);

  // Raise the first losers card (G4), then staircase later losers columns.
  let losersColOrdinal = 0;
  for (const games of losersByCol) {
    if (games.length === 0) continue;
    const lift =
      losersColOrdinal === 0
        ? LOSERS_FIRST_CARD_LIFT
        : LOSERS_FIRST_CARD_LIFT + losersColOrdinal * LOSERS_PROGRESSION_LIFT;
    for (const g of games) {
      const y = tops.get(g.id);
      if (y != null) tops.set(g.id, Math.max(COL_PAD_Y, y - lift));
    }
    losersColOrdinal += 1;
  }

  // Re-snap after lifts for single-feeder losers chains (e.g. 5-team G5→G7).
  // 6-team: G7 sits between G5 and G6; G9 between championship (G10) and G5.
  snapSingleWinnerFeederRows(losersByCol, edges, tops, hOf, losersIds, 1);
  const losersFlat = losersByCol.flat();
  centerBetweenGameNumbers(losersFlat, tops, hOf, "7", "5", "6", losersIds);

  // Championship + if-necessary: same horizon (align GF2 to GF1).
  const champCol = columns.findIndex((c) => isChampionshipColumn(c));
  const ifNecCol = columns.findIndex((c) => isIfNecessaryColumn(c));
  if (champCol >= 0 && ifNecCol >= 0) {
    const gf1Game = sortColumnGames(columns[champCol]!.games, byGameId)[0];
    const gf2Game = sortColumnGames(columns[ifNecCol]!.games, byGameId)[0];
    if (gf1Game && gf2Game) {
      const y1 = tops.get(gf1Game.id);
      if (y1 != null) tops.set(gf2Game.id, y1);
    }
  }

  // After G10 is placed, park G9 halfway between G10 and G5.
  const allFlat = columns.flatMap((c) => c.games);
  centerBetweenGameNumbers(allFlat, tops, hOf, "9", "10", "5");

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

/** Layout-space rect (undo CSS zoom/scale so SVG paths stay aligned). */
function layoutRect(el: HTMLElement, board: HTMLElement) {
  const er = el.getBoundingClientRect();
  const br = board.getBoundingClientRect();
  const sx = board.offsetWidth > 0 ? br.width / board.offsetWidth : 1;
  const sy = board.offsetHeight > 0 ? br.height / board.offsetHeight : 1;
  const scaleX = Math.abs(sx) < 0.001 ? 1 : sx;
  const scaleY = Math.abs(sy) < 0.001 ? 1 : sy;
  const left = (er.left - br.left) / scaleX;
  const top = (er.top - br.top) / scaleY;
  const width = er.width / scaleX;
  const height = er.height / scaleY;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function buildJoinPaths(edges: WinnerEdge[], board: HTMLElement): DrawnPath[] {
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
    const t = layoutRect(toEl, board);
    if (t.width < 2) continue;

    const x2 = t.left;
    const meetY = t.top + t.height / 2;

    const sources: SourcePt[] = [];
    for (const edge of group) {
      const fromEl = board.querySelector<HTMLElement>(
        `[data-bracket-game-id="${edge.fromGameId}"]`,
      );
      if (!fromEl) continue;
      const f = layoutRect(fromEl, board);
      if (f.width < 2) continue;
      sources.push({
        x1: f.right,
        y1: f.top + f.height / 2,
      });
    }
    if (sources.length === 0) continue;

    const maxSourceRight = Math.max(...sources.map((s) => s.x1));
    const joinX = Math.min(x2 - 12, Math.max(maxSourceRight + 16, x2 - JOIN_INSET));

    if (sources.length === 1) {
      const s = sources[0]!;
      // Prefer a true horizontal when centers already match (1-line vs 2-line cards).
      if (Math.abs(s.y1 - meetY) < 1.5) {
        paths.push({ d: `M ${s.x1} ${s.y1} H ${x2}` });
      } else {
        paths.push({ d: `M ${s.x1} ${s.y1} H ${joinX} V ${meetY} H ${x2}` });
      }
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
  const fromEl = board.querySelector<HTMLElement>(`[data-bracket-game-id="${gf1Id}"]`);
  const toEl = board.querySelector<HTMLElement>(`[data-bracket-game-id="${gf2Id}"]`);
  if (!fromEl || !toEl) return null;
  const f = layoutRect(fromEl, board);
  const t = layoutRect(toEl, board);
  if (f.width < 2 || t.width < 2) return null;
  return {
    d: `M ${f.right} ${f.top + f.height / 2} H ${t.left}`,
    dashed: true,
  };
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
  const gf1Label = gf1?.gameNumber?.trim() ? `G${gf1.gameNumber.trim()}` : "the championship game";
  const gf2Num = (() => {
    const n = Number.parseInt(String(gf1?.gameNumber ?? ""), 10);
    return Number.isFinite(n) ? `G${n + 1}` : "the if-necessary game";
  })();
  const pendingFooter = `${gf2Num} is only required if the losers-bracket champion wins ${gf1Label}; otherwise the tournament ends there.`;

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
        ? `${gf2Num} is not required — congratulations to ${winnerName}!`
        : `${gf2Num} is not required.`,
      winnerName,
    };
  }

  return {
    shaded: false,
    footer: `${gf2Num} is required — both remaining teams have one loss. Play the if-necessary championship.`,
    winnerName,
  };
}

export function ChronologicalRoundBracket({
  rounds,
  byRound,
  timeZone,
  format = "DOUBLE_ELIMINATION",
  showHomeAway = true,
}: {
  rounds: BracketRound[];
  byRound: Map<string, GameRow[]>;
  timeZone?: string | null;
  format?: BracketFormat | string;
  showHomeAway?: boolean;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<DrawnPath[]>([]);
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 });
  const [heights, setHeights] = useState<Map<string, number>>(() => new Map());
  const [colWidths, setColWidths] = useState<number[]>([]);

  const allGamesFlat = useMemo(() => [...byRound.values()].flat(), [byRound]);
  const byGameId = useMemo(() => gameIdMap(allGamesFlat), [allGamesFlat]);

  const gamesByRound = useMemo(() => {
    const map = new Map<string, GameRow[]>();
    for (const [id, games] of byRound) {
      map.set(id, sortColumnGames(games, byGameId));
    }
    return map;
  }, [byRound, byGameId]);

  const columns = useMemo(
    () => chronologicalRoundColumns(rounds, gamesByRound),
    [rounds, gamesByRound],
  );

  const allGames = useMemo(() => columns.flatMap((col) => col.games), [columns]);
  const winnerEdges = useMemo(() => collectWinnerEdges(allGames), [allGames]);

  const champColIdx = columns.findIndex((c) => isChampionshipColumn(c));
  const ifNecColIdx = columns.findIndex((c) => isIfNecessaryColumn(c));
  const gf1 =
    champColIdx >= 0 ? sortColumnGames(columns[champColIdx]!.games, byGameId)[0] : undefined;
  const gf2 =
    ifNecColIdx >= 0 ? sortColumnGames(columns[ifNecColIdx]!.games, byGameId)[0] : undefined;

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

    let raf = 0;
    const measureAndDraw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const nextHeights = new Map<string, number>();
        const nextColWidths: number[] = columns.map((col) => {
          let longestWord = 0;
          for (const g of col.games) {
            const wrap = board.querySelector<HTMLElement>(`[data-bracket-game-id="${g.id}"]`);
            if (!wrap) continue;
            nextHeights.set(g.id, wrap.offsetHeight);
            for (const nameEl of wrap.querySelectorAll<HTMLElement>("[data-bracket-team-name]")) {
              const style = getComputedStyle(nameEl);
              const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
              // Prefer text without the (A)/(H) tag for word width.
              const label = nameEl.childNodes[0]?.textContent ?? nameEl.textContent ?? "";
              longestWord = Math.max(longestWord, longestWordWidthPx(label, font));
            }
          }
          // Stay at default when words fit; widen only for a long unbroken token.
          return bracketColumnWidthForLongestWord(longestWord);
        });

        let heightsChanged = nextHeights.size !== heights.size;
        if (!heightsChanged) {
          for (const [id, h] of nextHeights) {
            if (heights.get(id) !== h) {
              heightsChanged = true;
              break;
            }
          }
        }
        let widthsChanged =
          nextColWidths.length !== colWidths.length ||
          nextColWidths.some((w, i) => w !== colWidths[i]);

        if (heightsChanged) {
          setHeights(nextHeights);
          return;
        }
        if (widthsChanged) {
          setColWidths(nextColWidths);
          return;
        }

        setBoardSize({ w: board.scrollWidth, h: board.scrollHeight });
        const next = buildJoinPaths(winnerEdges, board);
        if (gf1 && gf2 && !ifNecUi.shaded) {
          const dashed = buildIfNecessaryDashedPath(gf1.id, gf2.id, board);
          if (dashed) next.push(dashed);
        }
        setPaths(next);
      });
    };

    const hardRemeasure = () => {
      // Force card height re-read after rotate / zoom (layout can briefly be stale).
      setHeights(new Map());
      setColWidths([]);
      measureAndDraw();
    };

    measureAndDraw();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureAndDraw) : null;
    ro?.observe(board);
    window.addEventListener("resize", hardRemeasure);
    window.addEventListener("orientationchange", hardRemeasure);
    window.addEventListener("bracket-zoom-change", measureAndDraw);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measureAndDraw);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", hardRemeasure);
      window.removeEventListener("orientationchange", hardRemeasure);
      window.removeEventListener("bracket-zoom-change", measureAndDraw);
      vv?.removeEventListener("resize", measureAndDraw);
    };
  }, [allGames, columns, winnerEdges, heights, colWidths, tops, contentH, gf1, gf2, ifNecUi.shaded]);

  const columnShellH = contentH + HEADER_H;

  return (
    <div role="region" aria-label="Chronological double-elimination rounds">
      <div
        ref={boardRef}
        className="relative flex w-max min-w-full items-stretch gap-5"
        style={{ minHeight: columnShellH }}
      >
        {columns.map((col, ci) => {
          const games = sortColumnGames(col.games, byGameId);
          const isIfNec = isIfNecessaryColumn(col);
          const shade = isIfNec && ifNecUi.shaded;
          return (
            <div
              key={`${col.label}-${ci}`}
              className={`relative z-0 ${BRACKET_ROUND_COLUMN_CLASS} rounded-xl border ${
                shade
                  ? "border-zinc-200 bg-zinc-100/90 opacity-55"
                  : "border-zinc-200 bg-zinc-50/80"
              }`}
              style={{
                height: columnShellH,
                width: colWidths[ci] ?? BRACKET_COL_DEFAULT_PX,
              }}
            >
              <div
                className="flex shrink-0 flex-col justify-center border-b border-zinc-200 bg-white px-3 py-2"
                style={{ minHeight: HEADER_H }}
              >
                <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-royal">
                  {col.label}
                </h3>
                {col.subtitle ? (
                  <p className="mt-0.5 text-[11px] font-medium text-zinc-600">{col.subtitle}</p>
                ) : (
                  <p className="mt-0.5 text-[11px] font-medium text-transparent" aria-hidden>
                    &nbsp;
                  </p>
                )}
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
                        showHomeAway={showHomeAway}
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
