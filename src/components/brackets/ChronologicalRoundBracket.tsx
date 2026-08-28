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
import { CollapsedRoundStrip } from "@/components/brackets/CollapsedRoundStrip";
import { useRoundFocus } from "@/components/brackets/use-round-focus";
import {
  chronologicalRoundColumns,
  type ChronologicalRoundColumn,
} from "@/lib/brackets/bracket-display";
import {
  latestScoredColumnIndex,
} from "@/lib/brackets/bracket-round-window";
import { withBracketRoundDay } from "@/lib/datetime-tournament";
import {
  bracketLoserTeamId,
  bracketLossCountsFromGames,
  bracketWinnerTeamId,
  eliminationLossLimit,
} from "@/lib/services/bracket-engine";
import {
  isOba13SitOutGameNumber,
  oba13EndgameBranchForGameNumber,
  oba13SitOutByeNote,
  oba13PublicEndgameMode,
  OBA13_ROUND_5_REDRAW_NOTE,
} from "@/lib/services/oba-de-13";

type WinnerEdge = {
  fromGameId: string;
  toGameId: string;
  slot: "home" | "away";
};

type DrawnPath = { d: string; dashed?: boolean };

const EST_CARD_H = 148;
const MIN_GAP = 36;
const BAND_GAP = 56;
const COL_PAD_Y = 12;
const HEADER_H = 56;
const JOIN_INSET = 28;
/** Raise each successive losers-lane column to show progression (G5 above G4, G9 above G7). */
const LOSERS_PROGRESSION_LIFT = 52;
/** Extra rise for the first losers-lane card (e.g. G4 under G3). */
const LOSERS_FIRST_CARD_LIFT = 40;
const IF_NEC_FOOTER_H = 88;
const R5_NOTE_OFFSET = 128;
const SITOUT_NOTE_OFFSET = 42;
const G15_NEAR_G13_GAP = 28;

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

function collectWinnerEdges(games: GameRow[], byGameId: Map<string, GameRow>): WinnerEdge[] {
  const edges: WinnerEdge[] = [];
  for (const g of games) {
    const bm = g.bracketMatch;
    if (!bm) continue;
    const pushIfWinnersLane = (
      fromId: string | undefined,
      slot: "home" | "away",
      kind: string | null | undefined,
    ) => {
      if (!fromId || kind !== "WINNER") return;
      const from = byGameId.get(fromId);
      if (!from) return;
      // Lines are for the winners path only — skip consolation / losers-lane feeders
      // (e.g. G9 → G14 is a winner-of-losers hop, not a winners-bracket join).
      if (isLosersLaneGame(from, byGameId) || isLosersLaneGame(g, byGameId)) return;
      edges.push({ fromGameId: fromId, toGameId: g.id, slot });
    };
    pushIfWinnersLane(bm.awayFromMatch?.game?.id, "away", bm.awayFromKind);
    pushIfWinnersLane(bm.homeFromMatch?.game?.id, "home", bm.homeFromKind);
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

function isRoundNumberColumn(label: string, n: number): boolean {
  return new RegExp(`^round\\s*${n}\\b`, "i").test(label.trim());
}

type DecoratedColumn = ChronologicalRoundColumn<GameRow> & {
  roundNote?: string;
  sitOutNote?: string;
  noteOffset: number;
};

function decorateColumns(
  columns: ChronologicalRoundColumn<GameRow>[],
  isOba13: boolean,
): DecoratedColumn[] {
  return columns.map((col) => {
    const sitOutNote = isOba13 ? oba13SitOutByeNote(col.games) : null;
    const roundNote =
      isOba13 && isRoundNumberColumn(col.label, 5) ? OBA13_ROUND_5_REDRAW_NOTE : undefined;
    let noteOffset = 0;
    if (roundNote) noteOffset += R5_NOTE_OFFSET;
    if (sitOutNote) noteOffset += SITOUT_NOTE_OFFSET;
    return {
      ...col,
      games: isOba13 ? col.games.filter((g) => !isOba13SitOutGameNumber(g.gameNumber)) : col.games,
      roundNote,
      sitOutNote: sitOutNote ?? undefined,
      noteOffset,
    };
  });
}

function splitOba13Endgame(columns: DecoratedColumn[]): {
  early: DecoratedColumn[];
  late: DecoratedColumn[];
  bracketA: DecoratedColumn[];
  bracketB: DecoratedColumn[];
  endgameStart: number;
} {
  const start = columns.findIndex((c) => isRoundNumberColumn(c.label, 6));
  if (start < 0) {
    return { early: columns, late: [], bracketA: [], bracketB: [], endgameStart: columns.length };
  }
  const late = columns.slice(start);
  const take = (branch: "A" | "B") =>
    late.map((c) => {
      const games = c.games.filter((g) => oba13EndgameBranchForGameNumber(g.gameNumber) === branch);
      const sitOutNote = branch === "A" ? c.sitOutNote : undefined;
      const noteOffset = sitOutNote ? SITOUT_NOTE_OFFSET : 0;
      return { ...c, games, roundNote: undefined, sitOutNote, noteOffset };
    });
  return {
    early: columns.slice(0, start),
    late,
    bracketA: take("A"),
    bracketB: take("B"),
    endgameStart: start,
  };
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

/** Place `upperNum` a step above `baseNum` (losers-lane progression). */
function stepAboveGameNumber(
  games: GameRow[],
  tops: Map<string, number>,
  upperNum: string,
  baseNum: string,
  lift: number,
): void {
  const upper = gameByNumber(games, upperNum);
  const base = gameByNumber(games, baseNum);
  if (!upper || !base) return;
  const baseY = tops.get(base.id);
  if (baseY == null) return;
  tops.set(upper.id, Math.max(COL_PAD_Y, baseY - lift));
}

/** Match vertical centers of two games (e.g. 7-team G11 with G6). */
function alignCentersToGameNumber(
  games: GameRow[],
  tops: Map<string, number>,
  hOf: (id: string) => number,
  moveNum: string,
  targetNum: string,
): void {
  const move = gameByNumber(games, moveNum);
  const target = gameByNumber(games, targetNum);
  if (!move || !target) return;
  const targetY = tops.get(target.id);
  if (targetY == null) return;
  tops.set(move.id, targetY + hOf(target.id) / 2 - hOf(move.id) / 2);
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
 * card heights differ. 6-team: G7 between G5/G6, G9 between G10 and G5.
 * 7-team: G10 between G7/G8, G11 level with winners G6.
 */
function layoutGameTops(
  columns: { games: GameRow[]; subtitle?: string }[],
  edges: WinnerEdge[],
  heights: Map<string, number>,
  isOba13 = false,
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
  // Note: snap aligns G7 with G5; 5-team then steps G7 up again below.
  snapSingleWinnerFeederRows(losersByCol, edges, tops, hOf, losersIds, 1);
  const losersFlat = losersByCol.flat();
  // 6-team: G7 between G5 and G6.
  centerBetweenGameNumbers(losersFlat, tops, hOf, "7", "5", "6", losersIds);
  // 5-team: no losers-lane G6 — raise G7 above G5 by the same step as G4→G5.
  if (!gameByNumber(losersFlat, "6")) {
    stepAboveGameNumber(losersFlat, tops, "7", "5", LOSERS_PROGRESSION_LIFT);
  }
  // 7-team: G10 between G7 and G8.
  centerBetweenGameNumbers(losersFlat, tops, hOf, "10", "7", "8", losersIds);

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

  const allFlat = columns.flatMap((c) => c.games);
  // 7-team: G11 (losers) level with winners-lane G6 for progression.
  // (6-team G11 is championship — skip when G11 is not losers-lane.)
  {
    const g11 = gameByNumber(allFlat, "11");
    const g6 = gameByNumber(allFlat, "6");
    if (g11 && g6 && losersIds.has(g11.id) && winnersIds.has(g6.id)) {
      alignCentersToGameNumber(allFlat, tops, hOf, "11", "6");
    }
  }
  // 6-team only: G9 is losers-lane — park halfway between championship G10 and G5.
  // (7-team G9 is winners final; do not move it.)
  const g9 = gameByNumber(allFlat, "9");
  if (g9 && losersIds.has(g9.id)) {
    centerBetweenGameNumbers(allFlat, tops, hOf, "9", "10", "5");
  }

  if (isOba13) {
    alignCentersToGameNumber(allFlat, tops, hOf, "14", "6");
    centerBetweenGameNumbers(allFlat, tops, hOf, "13", "7", "8");
    const g13 = gameByNumber(allFlat, "13");
    const g15 = gameByNumber(allFlat, "15");
    if (g13 && g15) {
      const y13 = tops.get(g13.id);
      if (y13 != null) tops.set(g15.id, y13 + hOf(g13.id) + G15_NEAR_G13_GAP);
    }
    alignCentersToGameNumber(allFlat, tops, hOf, "19", "6");
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

function alwaysOpenColumn(_index: number): boolean {
  return true;
}

function noopToggle(_index: number): void {}

function ChronoBoard({
  columns,
  byGameId,
  timeZone,
  format,
  showHomeAway,
  isOba13,
  expandAll,
  isOpen,
  onToggle,
  hideHeaders = false,
  blankEmpty = false,
  fixedColWidth,
}: {
  columns: DecoratedColumn[];
  byGameId: Map<string, GameRow>;
  timeZone?: string | null;
  format: BracketFormat | string;
  showHomeAway: boolean;
  isOba13: boolean;
  expandAll: boolean;
  isOpen: (index: number) => boolean;
  onToggle: (index: number) => void;
  hideHeaders?: boolean;
  blankEmpty?: boolean;
  fixedColWidth?: number;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<DrawnPath[]>([]);
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 });
  const [heights, setHeights] = useState<Map<string, number>>(() => new Map());
  const [colWidths, setColWidths] = useState<number[]>([]);

  const layoutColumns = useMemo(
    () => columns.map((col, i) => (isOpen(i) ? col : { ...col, games: [] as GameRow[] })),
    [columns, isOpen],
  );
  const allGames = useMemo(() => layoutColumns.flatMap((col) => col.games), [layoutColumns]);
  const winnerEdges = useMemo(
    () => collectWinnerEdges(allGames, byGameId),
    [allGames, byGameId],
  );

  const champColIdx = layoutColumns.findIndex((c) => isChampionshipColumn(c) && c.games.length > 0);
  const ifNecColIdx = layoutColumns.findIndex((c) => isIfNecessaryColumn(c) && c.games.length > 0);
  const gf1 =
    champColIdx >= 0 ? sortColumnGames(layoutColumns[champColIdx]!.games, byGameId)[0] : undefined;
  const gf2 =
    ifNecColIdx >= 0 ? sortColumnGames(layoutColumns[ifNecColIdx]!.games, byGameId)[0] : undefined;

  const ifNecUi = useMemo(
    () => resolveIfNecessaryUi(gf1, allGames, format),
    [gf1, allGames, format],
  );

  const tops = useMemo(
    () => layoutGameTops(layoutColumns, winnerEdges, heights, isOba13),
    [layoutColumns, winnerEdges, heights, isOba13],
  );

  const maxNote = Math.max(0, ...layoutColumns.map((c) => (c.games.length ? c.noteOffset : 0)));
  const contentH = useMemo(
    () =>
      boardContentHeight(
        allGames,
        tops,
        heights,
        (ifNecColIdx >= 0 ? IF_NEC_FOOTER_H : 0) + maxNote,
      ),
    [allGames, tops, heights, ifNecColIdx, maxNote],
  );

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    let raf = 0;
    const measureAndDraw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const nextHeights = new Map<string, number>();
        const nextColWidths: number[] = columns.map((col, ci) => {
          if (fixedColWidth != null) return fixedColWidth;
          if (!isOpen(ci)) return 44;
          let longestWord = 0;
          for (const g of col.games) {
            const wrap = board.querySelector<HTMLElement>(`[data-bracket-game-id="${g.id}"]`);
            if (!wrap) continue;
            nextHeights.set(g.id, wrap.offsetHeight);
            for (const nameEl of wrap.querySelectorAll<HTMLElement>("[data-bracket-team-name]")) {
              const style = getComputedStyle(nameEl);
              const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
              const label = nameEl.childNodes[0]?.textContent ?? nameEl.textContent ?? "";
              longestWord = Math.max(longestWord, longestWordWidthPx(label, font));
            }
          }
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
        const widthsChanged =
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
  }, [
    allGames,
    columns,
    winnerEdges,
    heights,
    colWidths,
    tops,
    contentH,
    gf1,
    gf2,
    ifNecUi.shaded,
    isOpen,
    hideHeaders,
    fixedColWidth,
  ]);

  const columnShellH = contentH + (hideHeaders ? 0 : HEADER_H);

  return (
    <div
      ref={boardRef}
      className={`relative flex items-stretch gap-5 ${hideHeaders ? "w-max" : "w-max min-w-full"}`}
      style={{ minHeight: columnShellH }}
    >
      {columns.map((col, ci) => {
        if (!isOpen(ci)) {
          return (
            <CollapsedRoundStrip
              key={`${col.label}-${ci}-collapsed`}
              label={col.label}
              onExpand={() => onToggle(ci)}
            />
          );
        }
        const games = sortColumnGames(col.games, byGameId);
        const isIfNec = isIfNecessaryColumn(col);
        const shade = isIfNec && ifNecUi.shaded;
        const noteTop = COL_PAD_Y;
        return (
          <div
            key={`${col.label}-${ci}`}
            className={`relative ${BRACKET_ROUND_COLUMN_CLASS} ${
              hideHeaders ? "rounded-lg" : "rounded-xl"
            } ${shade ? "bg-zinc-100" : hideHeaders ? "bg-transparent" : "bg-zinc-50"}`}
            style={{
              height: columnShellH,
              width: colWidths[ci] ?? BRACKET_COL_DEFAULT_PX,
            }}
          >
            {hideHeaders ? null : (
              <div
                className="relative z-20 flex shrink-0 flex-col items-center justify-center border-b border-zinc-200 bg-white px-3 py-2 text-center"
                style={{ minHeight: HEADER_H }}
              >
                <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-royal">
                  {withBracketRoundDay(col.label, games, timeZone)}
                </h3>
                {col.subtitle ? (
                  <p className="mt-0.5 text-[11px] font-medium text-zinc-600">{col.subtitle}</p>
                ) : (
                  <p className="mt-0.5 text-[11px] font-medium text-transparent" aria-hidden>
                    &nbsp;
                  </p>
                )}
                {!expandAll ? (
                  <button
                    type="button"
                    className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 hover:text-royal"
                    onClick={() => onToggle(ci)}
                  >
                    Hide
                  </button>
                ) : null}
              </div>
            )}
            <div className="relative flex-1 px-3" style={{ height: contentH }}>
              {col.roundNote || col.sitOutNote ? (
                <div
                  className="absolute left-3 right-3 z-20 space-y-1.5"
                  style={{ top: noteTop }}
                >
                  {col.roundNote ? (
                    <p className="text-[10px] leading-snug text-zinc-600">{col.roundNote}</p>
                  ) : null}
                  {col.sitOutNote ? (
                    <p className="text-[11px] font-semibold leading-snug text-royal">{col.sitOutNote}</p>
                  ) : null}
                </div>
              ) : null}
              {games.length === 0 && !col.roundNote && !col.sitOutNote ? (
                blankEmpty ? null : (
                  <p className="pt-4 text-sm text-zinc-500">Matchups TBA.</p>
                )
              ) : (
                games.map((g, mi) => (
                  <div
                    key={g.id}
                    data-bracket-game-id={g.id}
                    className={`absolute left-3 right-3 z-20 ${shade ? "pointer-events-none" : ""}`}
                    style={{ top: (tops.get(g.id) ?? COL_PAD_Y) + col.noteOffset }}
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
            {hideHeaders ? null : (
              <div
                className={`pointer-events-none absolute inset-0 z-[15] rounded-xl border ${
                  shade ? "border-zinc-300" : "border-zinc-200"
                }`}
                aria-hidden
              />
            )}
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
  );
}

function Oba13EndgamePanel({
  late,
  bracketA,
  bracketB,
  byGameId,
  timeZone,
  format,
  showHomeAway,
  expandAll,
  onHide,
  mode,
}: {
  late: DecoratedColumn[];
  bracketA: DecoratedColumn[];
  bracketB: DecoratedColumn[];
  byGameId: Map<string, GameRow>;
  timeZone?: string | null;
  format: BracketFormat | string;
  showHomeAway: boolean;
  expandAll: boolean;
  onHide: () => void;
  mode: "placeholder" | "A" | "B";
}) {
  const showA = mode === "placeholder" || mode === "A";
  const showB = mode === "placeholder" || mode === "B";
  const placeholder = mode === "placeholder";
  const colWidth = BRACKET_COL_DEFAULT_PX;

  return (
    <div className="flex shrink-0 flex-col rounded-2xl border-2 border-zinc-200 bg-white p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">Endgame</p>
        {!expandAll ? (
          <button
            type="button"
            className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 hover:text-royal"
            onClick={onHide}
          >
            Hide
          </button>
        ) : null}
      </div>
      <div className="flex gap-5">
        {late.map((col) => (
          <div
            key={`endgame-h-${col.label}`}
            className="flex shrink-0 flex-col items-center justify-center px-2 pb-2 text-center"
            style={{ width: colWidth }}
          >
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-royal">
              {withBracketRoundDay(col.label, col.games, timeZone)}
            </h3>
            {col.subtitle ? (
              <p className="mt-0.5 text-[11px] font-medium text-zinc-600">{col.subtitle}</p>
            ) : null}
          </div>
        ))}
      </div>
      {showA ? (
        <div
          className={`rounded-xl py-2 ${
            placeholder
              ? "border-2 border-royal bg-royal-50/80"
              : "border border-zinc-200 bg-zinc-50/60"
          }`}
        >
          <p className={`px-3 text-xs font-bold uppercase tracking-[0.08em] ${placeholder ? "text-royal" : "text-zinc-700"}`}>
            Bracket A
          </p>
          <p className="mb-2 mt-0.5 px-3 text-[11px] leading-snug text-zinc-600">
            {placeholder
              ? "Bracket A to be used if 3 teams remaining"
              : "3 teams remaining"}
          </p>
          <ChronoBoard
            columns={bracketA}
            byGameId={byGameId}
            timeZone={timeZone}
            format={format}
            showHomeAway={showHomeAway}
            isOba13
            expandAll
            isOpen={alwaysOpenColumn}
            onToggle={noopToggle}
            hideHeaders
            blankEmpty
            fixedColWidth={colWidth}
          />
        </div>
      ) : null}
      {showB ? (
        <div
          className={`mt-2 rounded-xl py-2 ${
            placeholder
              ? "border-2 border-accent bg-accent-50/80"
              : "border border-zinc-200 bg-zinc-50/60"
          }`}
        >
          <p className={`px-3 text-xs font-bold uppercase tracking-[0.08em] ${placeholder ? "text-accent-800" : "text-zinc-700"}`}>
            Bracket B
          </p>
          <p className="mb-2 mt-0.5 px-3 text-[11px] leading-snug text-zinc-600">
            {placeholder
              ? "Bracket B to be used if 4 teams remaining"
              : "4 teams remaining"}
          </p>
          <ChronoBoard
            columns={bracketB}
            byGameId={byGameId}
            timeZone={timeZone}
            format={format}
            showHomeAway={showHomeAway}
            isOba13
            expandAll
            isOpen={alwaysOpenColumn}
            onToggle={noopToggle}
            hideHeaders
            blankEmpty
            fixedColWidth={colWidth}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ChronologicalRoundBracket({
  rounds,
  byRound,
  timeZone,
  format = "DOUBLE_ELIMINATION",
  showHomeAway = true,
  presetKey,
  expandAll = false,
}: {
  rounds: BracketRound[];
  byRound: Map<string, GameRow[]>;
  timeZone?: string | null;
  format?: BracketFormat | string;
  showHomeAway?: boolean;
  presetKey?: string | null;
  expandAll?: boolean;
}) {
  const isOba13 = presetKey === "oba_de_13";
  const allGamesFlat = useMemo(() => [...byRound.values()].flat(), [byRound]);
  const byGameId = useMemo(() => gameIdMap(allGamesFlat), [allGamesFlat]);

  const gamesByRound = useMemo(() => {
    const map = new Map<string, GameRow[]>();
    for (const [id, games] of byRound) {
      map.set(id, sortColumnGames(games, byGameId));
    }
    return map;
  }, [byRound, byGameId]);

  const rawColumns = useMemo(
    () => chronologicalRoundColumns(rounds, gamesByRound),
    [rounds, gamesByRound],
  );
  const columns = useMemo(() => decorateColumns(rawColumns, isOba13), [rawColumns, isOba13]);
  const activeIndex = useMemo(() => latestScoredColumnIndex(columns), [columns]);
  const focus = useRoundFocus(columns.length, activeIndex, expandAll);
  const split = useMemo(
    () => (isOba13 ? splitOba13Endgame(columns) : null),
    [columns, isOba13],
  );
  const endgameMode = useMemo(
    () => (isOba13 ? oba13PublicEndgameMode(allGamesFlat) : "placeholder"),
    [allGamesFlat, isOba13],
  );

  const endgameOpen = split
    ? expandAll || focus.rangeOverlaps(split.endgameStart, columns.length - 1)
    : false;

  const hasEndgame =
    !!split && (split.late.length > 0 || split.bracketA.length > 0 || split.bracketB.length > 0);

  return (
    <div
      className="flex w-max min-w-full items-stretch gap-5"
      role="region"
      aria-label="Chronological double-elimination rounds"
    >
      <ChronoBoard
        columns={split ? split.early : columns}
        byGameId={byGameId}
        timeZone={timeZone}
        format={format}
        showHomeAway={showHomeAway}
        isOba13={isOba13}
        expandAll={expandAll}
        isOpen={focus.isOpen}
        onToggle={focus.toggle}
      />
      {hasEndgame && split ? (
        endgameOpen ? (
          <Oba13EndgamePanel
            late={split.late}
            bracketA={split.bracketA}
            bracketB={split.bracketB}
            byGameId={byGameId}
            timeZone={timeZone}
            format={format}
            showHomeAway={showHomeAway}
            expandAll={expandAll}
            mode={endgameMode}
            onHide={() => {
              for (let i = split.endgameStart; i < columns.length; i++) {
                if (focus.isOpen(i)) focus.toggle(i);
              }
            }}
          />
        ) : (
          <CollapsedRoundStrip
            label="Rounds 6–8 · Endgame"
            onExpand={() => {
              for (let i = split.endgameStart; i < columns.length; i++) {
                if (!focus.isOpen(i)) focus.toggle(i);
              }
            }}
          />
        )
      ) : null}
    </div>
  );
}
