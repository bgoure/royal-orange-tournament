"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  isOba12SitOutGameNumber,
  oba12EndgameBranchForGameNumber,
  oba12PublicEndgameMode,
  oba12Round5RedrawPool,
  OBA12_ROUND_5_REDRAW_NOTE,
  type Oba12Round5RedrawPool,
} from "@/lib/services/oba-de-12";
import {
  isOba13SitOutGameNumber,
  oba13EndgameBranchForGameNumber,
  oba13PublicEndgameMode,
  oba13Round5RedrawPool,
  OBA13_ROUND_5_REDRAW_NOTE,
  type Oba13Round5RedrawPool,
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
    const pushWinner = (
      fromId: string | undefined,
      slot: "home" | "away",
      kind: string | null | undefined,
    ) => {
      if (!fromId || kind !== "WINNER") return;
      if (!byGameId.has(fromId)) return;
      edges.push({ fromGameId: fromId, toGameId: g.id, slot });
    };
    pushWinner(bm.awayFromMatch?.game?.id, "away", bm.awayFromKind);
    pushWinner(bm.homeFromMatch?.game?.id, "home", bm.homeFromKind);
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
  sitOutGames: GameRow[];
  noteOffset: number;
  redrawPool?: Oba13Round5RedrawPool | Oba12Round5RedrawPool;
};

function isObaSitOutGameNumber(n: string | null | undefined): boolean {
  return isOba13SitOutGameNumber(n) || isOba12SitOutGameNumber(n);
}

function decorateColumns(
  columns: ChronologicalRoundColumn<GameRow>[],
  mode: "13" | "12" | null,
): DecoratedColumn[] {
  const isObaDraw = mode === "13" || mode === "12";
  return columns.map((col) => {
    const sitOutGames = isObaDraw ? col.games.filter((g) => isObaSitOutGameNumber(g.gameNumber)) : [];
    const sitOutNote = null;
    const roundNote =
      mode === "13" && isRoundNumberColumn(col.label, 5)
        ? OBA13_ROUND_5_REDRAW_NOTE
        : mode === "12" && isRoundNumberColumn(col.label, 5)
          ? OBA12_ROUND_5_REDRAW_NOTE
          : undefined;
    let noteOffset = 0;
    if (roundNote) noteOffset += R5_NOTE_OFFSET;
    if (sitOutNote) noteOffset += SITOUT_NOTE_OFFSET;
    return {
      ...col,
      games: isObaDraw ? col.games.filter((g) => !isObaSitOutGameNumber(g.gameNumber)) : col.games,
      sitOutGames,
      roundNote,
      sitOutNote: sitOutNote ?? undefined,
      noteOffset,
    };
  });
}

function splitObaEndgame(
  columns: DecoratedColumn[],
  branchFor: (n: string | null | undefined) => "A" | "B" | null,
): {
  early: DecoratedColumn[];
  late: DecoratedColumn[];
  bracketA: DecoratedColumn[];
  bracketB: DecoratedColumn[];
  endgameStart: number;
  sitOutNoteA: string | null;
  sitOutNoteB: string | null;
} {
  const start = columns.findIndex((c) => isRoundNumberColumn(c.label, 6));
  if (start < 0) {
    return {
      early: columns,
      late: [],
      bracketA: [],
      bracketB: [],
      endgameStart: columns.length,
      sitOutNoteA: null,
      sitOutNoteB: null,
    };
  }
  const late = columns.slice(start);
  const take = (branch: "A" | "B") =>
    late.map((c) => {
      const games = c.games.filter((g) => branchFor(g.gameNumber) === branch);
      // Sit-out copy lives under the A/B box that owns the bye — cards in R6–R8
      // still share one vertical origin so winner lines stay straight.
      return { ...c, games, roundNote: undefined, sitOutNote: undefined, sitOutGames: [], noteOffset: 0 };
    });
  return {
    early: columns.slice(0, start),
    late,
    bracketA: take("A"),
    bracketB: take("B"),
    endgameStart: start,
    sitOutNoteA: null,
    sitOutNoteB: null,
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

/** Place `belowNum` just under `aboveNum`. */
function placeBelowGameNumber(
  games: GameRow[],
  tops: Map<string, number>,
  hOf: (id: string) => number,
  belowNum: string,
  aboveNum: string,
  gap = MIN_GAP,
): void {
  const below = gameByNumber(games, belowNum);
  const above = gameByNumber(games, aboveNum);
  if (!below || !above) return;
  const ay = tops.get(above.id);
  if (ay == null) return;
  tops.set(below.id, ay + hOf(above.id) + gap);
}
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

/** Put a left-to-right chain on one horizontal center line (13-team 23A→24A→25A). */
function alignGameNumberChain(
  games: GameRow[],
  tops: Map<string, number>,
  hOf: (id: string) => number,
  nums: string[],
): void {
  const rows = nums
    .map((n) => gameByNumber(games, n))
    .filter((g): g is GameRow => g != null && tops.has(g.id));
  if (rows.length < 2) return;
  const first = rows[0]!;
  const center = (tops.get(first.id) ?? 0) + hOf(first.id) / 2;
  for (const g of rows) {
    tops.set(g.id, center - hOf(g.id) / 2);
  }
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
  isOba12 = false,
): Map<string, number> {
  const tops = new Map<string, number>();
  const hOf = (id: string) => heights.get(id) ?? EST_CARD_H;
  const byGameId = gameIdMap(columns.flatMap((c) => c.games));
  const onBoard = new Set(byGameId.keys());
  const boardEdges = edges.filter((e) => onBoard.has(e.fromGameId) && onBoard.has(e.toGameId));

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
        const feeders = boardEdges.filter((e) => e.toGameId === g.id);
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
          const sole = boardEdges.filter((e) => {
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
  snapSingleWinnerFeederRows(winnersByCol, boardEdges, tops, hOf, winnersIds);

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
      if (
        oba13EndgameBranchForGameNumber(g.gameNumber) === "A" ||
        oba12EndgameBranchForGameNumber(g.gameNumber) === "A"
      ) {
        continue;
      }
      const y = tops.get(g.id);
      if (y != null) tops.set(g.id, Math.max(COL_PAD_Y, y - lift));
    }
    losersColOrdinal += 1;
  }

  // Re-snap after lifts for single-feeder losers chains (e.g. 5-team G5→G7).
  // Note: snap aligns G7 with G5; 5-team then steps G7 up again below.
  snapSingleWinnerFeederRows(losersByCol, boardEdges, tops, hOf, losersIds, 1);
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
  // (7-team G9 is winners final; 13-team G9 must not cover G11 in the same column.)
  const g9 = gameByNumber(allFlat, "9");
  if (g9 && losersIds.has(g9.id) && !isOba13 && !isOba12) {
    centerBetweenGameNumbers(allFlat, tops, hOf, "9", "10", "5");
  }

  if (isOba13) {
    centerBetweenGameNumbers(allFlat, tops, hOf, "11", "3", "4");
    centerBetweenGameNumbers(allFlat, tops, hOf, "12", "5", "6");
    const g10 = gameByNumber(allFlat, "10");
    const g11 = gameByNumber(allFlat, "11");
    const g12 = gameByNumber(allFlat, "12");
    if (g10 && g11) {
      const minY = (tops.get(g10.id) ?? 0) + hOf(g10.id) + MIN_GAP;
      if ((tops.get(g11.id) ?? 0) < minY) tops.set(g11.id, minY);
    }
    if (g11 && g12) {
      const minY = (tops.get(g11.id) ?? 0) + hOf(g11.id) + MIN_GAP;
      if ((tops.get(g12.id) ?? 0) < minY) tops.set(g12.id, minY);
    }

    // G7 below G12 so they do not overlap; G8/G13 follow. G15/G14 swapped; G9 level with G14.
    placeBelowGameNumber(allFlat, tops, hOf, "7", "12");
    placeBelowGameNumber(allFlat, tops, hOf, "8", "7");
    centerBetweenGameNumbers(allFlat, tops, hOf, "13", "7", "8");
    placeBelowGameNumber(allFlat, tops, hOf, "15", "13");
    placeBelowGameNumber(allFlat, tops, hOf, "14", "15");
    centerBetweenGameNumbers(allFlat, tops, hOf, "18", "14", "15");
    alignCentersToGameNumber(allFlat, tops, hOf, "9", "14");
    alignCentersToGameNumber(allFlat, tops, hOf, "19", "5");
    // Bracket A is a single file (23A → 24A → 25A) — keep one horizon so joins are straight.
    alignGameNumberChain(allFlat, tops, hOf, ["23A", "24A", "25A"]);
  }

  if (isOba12) {
    centerBetweenGameNumbers(allFlat, tops, hOf, "10", "1", "2");
    centerBetweenGameNumbers(allFlat, tops, hOf, "11", "3", "4");
    centerBetweenGameNumbers(allFlat, tops, hOf, "12", "5", "6");
    const g10 = gameByNumber(allFlat, "10");
    const g11 = gameByNumber(allFlat, "11");
    const g12 = gameByNumber(allFlat, "12");
    if (g10 && g11) {
      const minY = (tops.get(g10.id) ?? 0) + hOf(g10.id) + MIN_GAP;
      if ((tops.get(g11.id) ?? 0) < minY) tops.set(g11.id, minY);
    }
    if (g11 && g12) {
      const minY = (tops.get(g11.id) ?? 0) + hOf(g11.id) + MIN_GAP;
      if ((tops.get(g12.id) ?? 0) < minY) tops.set(g12.id, minY);
    }
    centerBetweenGameNumbers(allFlat, tops, hOf, "16", "11", "12");
    placeBelowGameNumber(allFlat, tops, hOf, "7", "6");
    placeBelowGameNumber(allFlat, tops, hOf, "8", "7");
    centerBetweenGameNumbers(allFlat, tops, hOf, "13", "7", "8");
    placeBelowGameNumber(allFlat, tops, hOf, "9", "8");
    alignCentersToGameNumber(allFlat, tops, hOf, "15", "6");
    alignCentersToGameNumber(allFlat, tops, hOf, "14", "9");
    centerBetweenGameNumbers(allFlat, tops, hOf, "17", "13", "14");
    alignCentersToGameNumber(allFlat, tops, hOf, "18", "15");
    centerBetweenGameNumbers(allFlat, tops, hOf, "19", "2", "3");
    alignGameNumberChain(allFlat, tops, hOf, ["22A", "23A"]);
  }

  return tops;
}

function redrawPoolFooterH(pool: Oba13Round5RedrawPool | undefined): number {
  if (!pool) return 0;
  return 44 + pool.teams.length * 36 + (pool.waitingOn.length > 0 ? 18 : 0);
}

function redrawPoolTop(
  games: GameRow[],
  tops: Map<string, number>,
  heights: Map<string, number>,
  noteOffset: number,
): number {
  let max = COL_PAD_Y + noteOffset;
  for (const g of games) {
    const y = (tops.get(g.id) ?? COL_PAD_Y) + noteOffset;
    const h = heights.get(g.id) ?? EST_CARD_H;
    max = Math.max(max, y + h);
  }
  return max + 10;
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

function samePathList(a: DrawnPath[], b: DrawnPath[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const prev = a[i]!;
    const next = b[i]!;
    if (prev.d !== next.d || !!prev.dashed !== !!next.dashed) return false;
  }
  return true;
}

function sameHeightMap(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, h] of b) {
    if (a.get(id) !== h) return false;
  }
  return true;
}

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

function cardLayoutRect(wrap: HTMLElement, board: HTMLElement) {
  const card = wrap.querySelector("article") ?? wrap;
  return layoutRect(card, board);
}

function buildJoinPaths(
  edges: WinnerEdge[],
  board: HTMLElement,
  opts?: { forceStraightSingles?: boolean },
): DrawnPath[] {
  const byTarget = new Map<string, WinnerEdge[]>();
  for (const edge of edges) {
    const list = byTarget.get(edge.toGameId) ?? [];
    list.push(edge);
    byTarget.set(edge.toGameId, list);
  }

  const paths: DrawnPath[] = [];
  const forceStraight = opts?.forceStraightSingles === true;

  for (const [toGameId, group] of byTarget) {
    const toEl = board.querySelector<HTMLElement>(`[data-bracket-game-id="${toGameId}"]`);
    if (!toEl) continue;
    const t = cardLayoutRect(toEl, board);
    if (t.width < 2) continue;

    const x2 = t.left;
    const meetY = t.top + t.height / 2;

    const sources: SourcePt[] = [];
    for (const edge of group) {
      const fromEl = board.querySelector<HTMLElement>(
        `[data-bracket-game-id="${edge.fromGameId}"]`,
      );
      if (!fromEl) continue;
      const f = cardLayoutRect(fromEl, board);
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
      if (forceStraight || Math.abs(s.y1 - meetY) < 4) {
        const y = forceStraight ? (s.y1 + meetY) / 2 : s.y1;
        paths.push({ d: `M ${s.x1} ${y} H ${x2}` });
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
  isOba12 = false,
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
  isOba12?: boolean;
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
  const visibleById = useMemo(() => gameIdMap(allGames), [allGames]);
  const winnerEdges = useMemo(
    () => collectWinnerEdges(allGames, visibleById),
    [allGames, visibleById],
  );
  const lockSingleGameRow = useMemo(() => {
    let any = false;
    for (const col of layoutColumns) {
      if (col.games.length > 1) return false;
      if (col.games.length === 1) any = true;
    }
    return any;
  }, [layoutColumns]);
  const rowCardHeight = useMemo(() => {
    if (!lockSingleGameRow) return undefined;
    let max = 0;
    for (const g of allGames) max = Math.max(max, heights.get(g.id) ?? 0);
    return max > 0 ? max : undefined;
  }, [lockSingleGameRow, allGames, heights]);

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

  const tops = useMemo(() => {
    const base = layoutGameTops(layoutColumns, winnerEdges, heights, isOba13, isOba12);
    if (!lockSingleGameRow) return base;
    const locked = new Map(base);
    for (const g of allGames) locked.set(g.id, COL_PAD_Y);
    return locked;
  }, [layoutColumns, winnerEdges, heights, isOba13, isOba12, lockSingleGameRow, allGames]);

  const maxNote = Math.max(0, ...layoutColumns.map((c) => (c.games.length ? c.noteOffset : 0)));
  const poolFooter = Math.max(0, ...layoutColumns.map((c) => redrawPoolFooterH(c.redrawPool)));
  const contentH = useMemo(
    () =>
      boardContentHeight(
        allGames,
        tops,
        heights,
        (ifNecColIdx >= 0 ? IF_NEC_FOOTER_H : 0) + maxNote + poolFooter,
      ),
    [allGames, tops, heights, ifNecColIdx, maxNote, poolFooter],
  );

  const measureAndDraw = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;

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

    // Card heights feed the layout pass, so land them first and let the resulting
    // render schedule the next measurement.
    if (!sameHeightMap(heights, nextHeights)) {
      setHeights(nextHeights);
      return;
    }
    if (
      nextColWidths.length !== colWidths.length ||
      nextColWidths.some((w, i) => w !== colWidths[i])
    ) {
      setColWidths(nextColWidths);
      return;
    }

    const w = board.scrollWidth;
    const h = board.scrollHeight;
    setBoardSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));

    const nextPaths = buildJoinPaths(winnerEdges, board, {
      forceStraightSingles: lockSingleGameRow,
    });
    if (gf1 && gf2 && !ifNecUi.shaded) {
      const dashed = buildIfNecessaryDashedPath(gf1.id, gf2.id, board);
      if (dashed) nextPaths.push(dashed);
    }
    setPaths((prev) => (samePathList(prev, nextPaths) ? prev : nextPaths));
  }, [
    columns,
    winnerEdges,
    heights,
    colWidths,
    gf1,
    gf2,
    ifNecUi.shaded,
    isOpen,
    fixedColWidth,
    lockSingleGameRow,
  ]);

  const measureRef = useRef(measureAndDraw);
  const rafRef = useRef(0);

  /** Coalesce every trigger into a single measurement per frame. */
  const scheduleMeasure = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => measureRef.current());
  }, []);

  // Bracket data, round visibility, note offsets and card heights all land here.
  useLayoutEffect(() => {
    measureRef.current = measureAndDraw;
    scheduleMeasure();
  }, [measureAndDraw, scheduleMeasure, allGames, tops, contentH, hideHeaders]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    let live = true;

    const hardRemeasure = () => {
      if (!live) return;
      setHeights((prev) => (prev.size === 0 ? prev : new Map()));
      setColWidths((prev) => (prev.length === 0 ? prev : []));
      scheduleMeasure();
    };

    // Mobile browsers fire `resize` whenever the URL bar collapses. Height-only
    // changes cannot affect column widths or card heights, so ignore them —
    // `visualViewport` resize is skipped entirely for the same reason (it also
    // fires on every scroll and pinch).
    let lastViewportWidth = window.innerWidth;
    const onViewportResize = () => {
      if (window.innerWidth === lastViewportWidth) return;
      lastViewportWidth = window.innerWidth;
      hardRemeasure();
    };

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => scheduleMeasure()) : null;
    ro?.observe(board);
    window.addEventListener("resize", onViewportResize);
    window.addEventListener("orientationchange", hardRemeasure);
    window.addEventListener("bracket-zoom-change", scheduleMeasure);
    // Late web-font swaps change both card heights and longest-word widths.
    void document.fonts?.ready.then(hardRemeasure).catch(() => {});

    return () => {
      live = false;
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      window.removeEventListener("resize", onViewportResize);
      window.removeEventListener("orientationchange", hardRemeasure);
      window.removeEventListener("bracket-zoom-change", scheduleMeasure);
    };
  }, [scheduleMeasure]);

  const columnShellH = contentH + (hideHeaders ? 0 : HEADER_H);

  return (
    <div
      ref={boardRef}
      className="relative flex w-max items-stretch gap-5"
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
                      minHeight={lockSingleGameRow ? rowCardHeight : undefined}
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
              {col.redrawPool &&
              (col.redrawPool.teams.length > 0 || col.redrawPool.waitingOn.length > 0) ? (
                <div
                  className="absolute left-3 right-3 z-20 rounded-lg border border-royal/25 bg-white px-2 py-2 shadow-sm"
                  style={{ top: redrawPoolTop(games, tops, heights, col.noteOffset) }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-royal">
                    Available for Round 5
                  </p>
                  <ul className="mt-1 space-y-1.5">
                    {col.redrawPool.teams.map((t) => (
                      <li key={t.teamId} className="text-[11px] leading-snug text-zinc-800">
                        <span className="font-semibold">{t.name}</span>
                        <span className="text-zinc-500">
                          {t.losses === 0
                            ? " · undefeated"
                            : t.losses === 1
                              ? " · 1 loss"
                              : ` · ${t.losses} losses`}
                        </span>
                        <span className="block text-[10px] text-zinc-500">{t.how}</span>
                      </li>
                    ))}
                  </ul>
                  {col.redrawPool.waitingOn.length > 0 ? (
                    <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">
                      Waiting on Game {col.redrawPool.waitingOn.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
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

function Oba13EndgameOpenSlice({
  late,
  bracketA,
  bracketB,
  byGameId,
  timeZone,
  format,
  showHomeAway,
  expandAll,
  onToggleLocal,
  mode,
  aRemain = 3,
  bRemain = 4,
  isOba12 = false,
  sitOutNoteA = null,
  sitOutNoteB = null,
}: {
  late: DecoratedColumn[];
  bracketA: DecoratedColumn[];
  bracketB: DecoratedColumn[];
  byGameId: Map<string, GameRow>;
  timeZone?: string | null;
  format: BracketFormat | string;
  showHomeAway: boolean;
  expandAll: boolean;
  onToggleLocal: (localIndex: number) => void;
  mode: "placeholder" | "A" | "B";
  aRemain?: number;
  bRemain?: number;
  isOba12?: boolean;
  sitOutNoteA?: string | null;
  sitOutNoteB?: string | null;
}) {
  const showA = mode === "placeholder" || mode === "A";
  const showB = mode === "placeholder" || mode === "B";
  const placeholder = mode === "placeholder";
  const colWidth = BRACKET_COL_DEFAULT_PX;

  return (
    <div className="flex shrink-0 flex-col">
      <div className="mb-0 flex gap-5">
        {late.map((col, i) => (
          <div
            key={`endgame-h-${col.label}`}
            className="flex shrink-0 flex-col items-center justify-center border-b border-zinc-200 bg-white px-3 py-2 text-center"
            style={{ width: colWidth, minHeight: HEADER_H }}
          >
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-royal">
              {withBracketRoundDay(col.label, col.games, timeZone)}
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
                onClick={() => onToggleLocal(i)}
              >
                Hide
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {showA ? (
        <div
          className={`mt-2 rounded-xl py-2 ${
            placeholder
              ? "border-2 border-royal bg-royal-50/60"
              : "border border-zinc-200 bg-white"
          }`}
        >
          <p className={`px-3 text-xs font-bold uppercase tracking-[0.08em] ${placeholder ? "text-royal" : "text-zinc-700"}`}>
            Bracket A
          </p>
          {placeholder ? (
            <p className="mb-2 mt-0.5 px-3 text-[11px] leading-snug text-zinc-600">
              Bracket A to be used if {aRemain} teams remaining
            </p>
          ) : (
            <p className="mb-2 mt-0.5 px-3 text-[11px] leading-snug text-zinc-500">{aRemain} teams remaining</p>
          )}
          <ChronoBoard
            columns={bracketA}
            byGameId={byGameId}
            timeZone={timeZone}
            format={format}
            showHomeAway={showHomeAway}
            isOba13={!isOba12}
            isOba12={isOba12}
            expandAll
            isOpen={alwaysOpenColumn}
            onToggle={noopToggle}
            hideHeaders
            blankEmpty
            fixedColWidth={colWidth}
          />
          {sitOutNoteA ? (
            <p className="mt-2 px-3 text-[11px] font-semibold leading-snug text-royal">{sitOutNoteA}</p>
          ) : null}
        </div>
      ) : null}
      {showB ? (
        <div
          className={`mt-2 rounded-xl py-2 ${
            placeholder
              ? "border-2 border-accent bg-accent-50/70"
              : "border border-zinc-200 bg-white"
          }`}
        >
          <p className={`px-3 text-xs font-bold uppercase tracking-[0.08em] ${placeholder ? "text-accent-800" : "text-zinc-700"}`}>
            Bracket B
          </p>
          {placeholder ? (
            <p className="mb-2 mt-0.5 px-3 text-[11px] leading-snug text-zinc-600">
              Bracket B to be used if {bRemain} teams remaining
            </p>
          ) : (
            <p className="mb-2 mt-0.5 px-3 text-[11px] leading-snug text-zinc-500">{bRemain} teams remaining</p>
          )}
          <ChronoBoard
            columns={bracketB}
            byGameId={byGameId}
            timeZone={timeZone}
            format={format}
            showHomeAway={showHomeAway}
            isOba13={!isOba12}
            isOba12={isOba12}
            expandAll
            isOpen={alwaysOpenColumn}
            onToggle={noopToggle}
            hideHeaders
            blankEmpty
            fixedColWidth={colWidth}
          />
          {sitOutNoteB ? (
            <p className="mt-2 px-3 text-[11px] font-semibold leading-snug text-royal">{sitOutNoteB}</p>
          ) : null}
        </div>
      ) : null}
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
  isOpen,
  onToggle,
  mode,
  aRemain = 3,
  bRemain = 4,
  isOba12 = false,
  sitOutNoteA = null,
  sitOutNoteB = null,
}: {
  late: DecoratedColumn[];
  bracketA: DecoratedColumn[];
  bracketB: DecoratedColumn[];
  byGameId: Map<string, GameRow>;
  timeZone?: string | null;
  format: BracketFormat | string;
  showHomeAway: boolean;
  expandAll: boolean;
  isOpen: (index: number) => boolean;
  onToggle: (index: number) => void;
  mode: "placeholder" | "A" | "B";
  aRemain?: number;
  bRemain?: number;
  isOba12?: boolean;
  sitOutNoteA?: string | null;
  sitOutNoteB?: string | null;
}) {
  const segments: { kind: "collapsed" | "open"; start: number; end: number }[] = [];
  for (let i = 0; i < late.length; i++) {
    const open = isOpen(i);
    const last = segments[segments.length - 1];
    if (open) {
      if (last?.kind === "open") last.end = i;
      else segments.push({ kind: "open", start: i, end: i });
    } else {
      segments.push({ kind: "collapsed", start: i, end: i });
    }
  }

  return (
    <div className="flex items-stretch gap-5">
      {segments.map((seg) => {
        if (seg.kind === "collapsed") {
          const col = late[seg.start]!;
          return (
            <CollapsedRoundStrip
              key={`${col.label}-collapsed`}
              label={col.label}
              onExpand={() => onToggle(seg.start)}
            />
          );
        }
        return (
          <Oba13EndgameOpenSlice
            key={`open-${seg.start}-${seg.end}`}
            late={late.slice(seg.start, seg.end + 1)}
            bracketA={bracketA.slice(seg.start, seg.end + 1)}
            bracketB={bracketB.slice(seg.start, seg.end + 1)}
            byGameId={byGameId}
            timeZone={timeZone}
            format={format}
            showHomeAway={showHomeAway}
            expandAll={expandAll}
            onToggleLocal={(local) => onToggle(seg.start + local)}
            mode={mode}
            aRemain={aRemain}
            bRemain={bRemain}
            isOba12={isOba12}
            sitOutNoteA={sitOutNoteA}
            sitOutNoteB={sitOutNoteB}
          />
        );
      })}
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
  persistKey,
}: {
  rounds: BracketRound[];
  byRound: Map<string, GameRow[]>;
  timeZone?: string | null;
  format?: BracketFormat | string;
  showHomeAway?: boolean;
  presetKey?: string | null;
  expandAll?: boolean;
  persistKey?: string;
}) {
  const isOba13 = presetKey === "oba_de_13";
  const isOba12 = presetKey === "oba_de_12";
  const drawMode = isOba13 ? "13" : isOba12 ? "12" : null;
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
  const redrawPool = useMemo(
    () =>
      isOba13
        ? oba13Round5RedrawPool(allGamesFlat)
        : isOba12
          ? oba12Round5RedrawPool(allGamesFlat)
          : null,
    [allGamesFlat, isOba13, isOba12],
  );
  const columns = useMemo(() => {
    const base = decorateColumns(rawColumns, drawMode);
    if (!redrawPool) return base;
    return base.map((c) =>
      isRoundNumberColumn(c.label, 5) ? { ...c, redrawPool } : c,
    );
  }, [rawColumns, drawMode, redrawPool]);
  const activeIndex = useMemo(() => latestScoredColumnIndex(columns), [columns]);
  const focus = useRoundFocus(columns.length, activeIndex, expandAll, expandAll ? undefined : persistKey);
  const split = useMemo(
    () =>
      isOba13
        ? splitObaEndgame(columns, oba13EndgameBranchForGameNumber)
        : isOba12
          ? splitObaEndgame(columns, oba12EndgameBranchForGameNumber)
          : null,
    [columns, isOba13, isOba12],
  );
  const endgameMode = useMemo(
    () =>
      isOba13
        ? oba13PublicEndgameMode(allGamesFlat)
        : isOba12
          ? oba12PublicEndgameMode(allGamesFlat)
          : "placeholder",
    [allGamesFlat, isOba13, isOba12],
  );

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
        isOba12={isOba12}
        expandAll={expandAll}
        isOpen={focus.isOpen}
        onToggle={focus.toggle}
      />
      {hasEndgame && split ? (
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
          aRemain={isOba12 ? 2 : 3}
          bRemain={isOba12 ? 3 : 4}
          isOba12={isOba12}
          sitOutNoteA={split.sitOutNoteA}
          sitOutNoteB={split.sitOutNoteB}
          isOpen={(i) => focus.isOpen(split.endgameStart + i)}
          onToggle={(i) => focus.toggle(split.endgameStart + i)}
        />
      ) : null}
    </div>
  );
}
