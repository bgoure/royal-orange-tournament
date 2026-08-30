/**
 * Admin redraw placement for the 12-team OBA double-elim map.
 * Round 5: rematch-avoid pairing of 4 remaining teams into Games 20 and 21.
 * Bracket B Round 6: RP5.2 bye + Game 22B. Bracket A Game 22A is feeder-wired.
 */

import { GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { aliveTeamIds, bracketWinnerTeamId } from "@/lib/services/bracket-engine";
import {
  applyImplicitByeAwards,
  inferOba12ImplicitByes,
  OBA12_GAME,
  oba12EndgameBranch,
  suggestOba13OddRoundPairing,
  type Oba12EndgameBranch,
  type Oba13PairingSuggestion,
} from "@/lib/services/oba-de-12";
import { meetingKey } from "@/lib/services/rematch-aware-pairing";
import { coinFlipHomeAwaySeats } from "@/lib/services/bracket-home-coin-flip";

export type Oba12PlacementTeam = { id: string; name: string };

export type Oba12PlacementPhase = "r5" | "r6";

export type Oba12PlacementBoard = {
  bracketId: string;
  phase: Oba12PlacementPhase;
  branch: Oba12EndgameBranch | null;
  remaining: Oba12PlacementTeam[];
  suggestion: Oba13PairingSuggestion;
  eligibleByeTeamIds: string[];
  targetGameNumbers: string[];
  note: string;
};

type GameLite = {
  id: string;
  gameNumber: string | null;
  status: string;
  resultType: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeRuns: number | null;
  awayRuns: number | null;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  bracketMatch: { awayIsBye: boolean; homeIsBye: boolean } | null;
  bracketRound: { roundIndex: number } | null;
};

function byNumber(games: GameLite[], num: string): GameLite | undefined {
  return games.find((g) => (g.gameNumber ?? "") === num);
}

function isFinal(g: GameLite | undefined): boolean {
  return g?.status === "FINAL";
}

function winnerOfNum(games: GameLite[], num: string): string | null {
  const g = byNumber(games, num);
  if (!g || g.status !== "FINAL") return null;
  return bracketWinnerTeamId(g);
}

function allFinal(games: GameLite[], nums: string[]): boolean {
  return nums.every((n) => isFinal(byNumber(games, n)));
}

function seatsReady(games: GameLite[], nums: string[]): boolean {
  for (const n of nums) {
    const g = byNumber(games, n);
    if (!g) return false;
    if (g.status === "CANCELLED") return false;
    if (!g.homeTeamId) return false;
    const awayBye = g.bracketMatch?.awayIsBye === true;
    if (!awayBye && !g.awayTeamId) return false;
  }
  return true;
}

function teamMap(games: GameLite[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of games) {
    if (g.homeTeam) m.set(g.homeTeam.id, g.homeTeam.name);
    if (g.awayTeam) m.set(g.awayTeam.id, g.awayTeam.name);
  }
  return m;
}

function named(ids: string[], names: Map<string, string>): Oba12PlacementTeam[] {
  return ids.map((id) => ({ id, name: names.get(id) ?? id }));
}

async function loadGames(bracketId: string): Promise<GameLite[]> {
  return prisma.game.findMany({
    where: { bracketId },
    select: {
      id: true,
      gameNumber: true,
      status: true,
      resultType: true,
      homeTeamId: true,
      awayTeamId: true,
      homeRuns: true,
      awayRuns: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      bracketMatch: { select: { awayIsBye: true, homeIsBye: true } },
      bracketRound: { select: { roundIndex: true } },
    },
  });
}

function entrantsAndAlive(games: GameLite[]): { alive: string[] } {
  const entrants = new Set<string>();
  for (const g of games) {
    if (g.status === "CANCELLED") continue;
    if (g.homeTeamId) entrants.add(g.homeTeamId);
    if (g.awayTeamId) entrants.add(g.awayTeamId);
  }
  const ids = [...entrants];
  const alive = aliveTeamIds({
    format: "DOUBLE_ELIMINATION",
    entrantTeamIds: ids,
    games,
  });
  return { alive };
}

async function priorMeetings(bracketId: string): Promise<Set<string>> {
  const games = await prisma.game.findMany({
    where: {
      bracketId,
      status: "FINAL",
      homeTeamId: { not: null },
      awayTeamId: { not: null },
    },
    select: { homeTeamId: true, awayTeamId: true },
  });
  const set = new Set<string>();
  for (const g of games) {
    if (g.homeTeamId && g.awayTeamId) set.add(meetingKey(g.homeTeamId, g.awayTeamId));
  }
  return set;
}

async function suggestionFor(
  bracketId: string,
  teamIds: string[],
  currentRoundIndex: number,
): Promise<Oba13PairingSuggestion> {
  const { loadObaByeCandidatesForTeams } = await import("@/lib/services/bracket-advance");
  const games = await loadGames(bracketId);
  const { candidates: raw, gamesForRp73 } = await loadObaByeCandidatesForTeams(
    bracketId,
    teamIds,
    currentRoundIndex,
  );
  const implicit = inferOba12ImplicitByes(games, (num) => winnerOfNum(games, num));
  const candidates = applyImplicitByeAwards(raw, implicit, currentRoundIndex);
  const meetings = await priorMeetings(bracketId);
  return suggestOba13OddRoundPairing(teamIds, candidates, gamesForRp73, meetings);
}

export async function getOba12PlacementBoard(bracketId: string): Promise<Oba12PlacementBoard | null> {
  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    select: { id: true, presetKey: true },
  });
  if (bracket?.presetKey !== "oba_de_12") return null;

  const games = await loadGames(bracketId);
  const names = teamMap(games);
  const { alive } = entrantsAndAlive(games);

  if (!allFinal(games, [OBA12_GAME.G17, OBA12_GAME.G18, OBA12_GAME.G19])) return null;

  const r5Nums = [OBA12_GAME.G20, OBA12_GAME.G21];
  if (!seatsReady(games, r5Nums)) {
    const suggestion = await suggestionFor(bracketId, alive, 4);
    return {
      bracketId,
      phase: "r5",
      branch: null,
      remaining: named(alive, names),
      suggestion,
      eligibleByeTeamIds: suggestion.eligibleByeTeamIds,
      targetGameNumbers: r5Nums,
      note: "Round 5: 4 teams remain. Pair to avoid rematches. Confirm or override the suggestion.",
    };
  }

  if (!allFinal(games, r5Nums)) return null;

  const afterR5 = aliveTeamIds({
    format: "DOUBLE_ELIMINATION",
    entrantTeamIds: alive,
    games,
  });
  const branch = oba12EndgameBranch(afterR5.length);
  if (branch !== "B") return null;

  const r6b = [OBA12_GAME.BYE_R6, OBA12_GAME.G22B];
  if (!seatsReady(games, r6b)) {
    const suggestion = await suggestionFor(bracketId, afterR5, 5);
    return {
      bracketId,
      phase: "r6",
      branch: "B",
      remaining: named(afterR5, names),
      suggestion,
      eligibleByeTeamIds: suggestion.eligibleByeTeamIds,
      targetGameNumbers: r6b,
      note: "Bracket B (3 teams, all one loss). RP5.2 bye + Game 22B. Confirm or override.",
    };
  }
  return null;
}

export async function listOba12PlacementBoards(tournamentId: string): Promise<Oba12PlacementBoard[]> {
  const brackets = await prisma.bracket.findMany({
    where: { tournamentId, presetKey: "oba_de_12" },
    select: { id: true },
  });
  const boards: Oba12PlacementBoard[] = [];
  for (const b of brackets) {
    const board = await getOba12PlacementBoard(b.id);
    if (board) boards.push(board);
  }
  return boards;
}

async function gameIdByNumber(bracketId: string, gameNumber: string): Promise<string | null> {
  const g = await prisma.game.findFirst({
    where: { bracketId, gameNumber },
    select: { id: true },
  });
  return g?.id ?? null;
}

async function assignMatchup(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string | null,
  awayIsBye: boolean,
  coinFlip: boolean,
): Promise<void> {
  let home = homeTeamId as string | null;
  let away = awayTeamId;
  if (!awayIsBye) {
    ({ homeTeamId: home, awayTeamId: away } = coinFlipHomeAwaySeats(home, away, coinFlip));
  }
  await prisma.game.update({
    where: { id: gameId },
    data: {
      homeTeamId: home,
      awayTeamId: awayIsBye ? null : away,
      status: GameStatus.SCHEDULED,
    },
  });
}

async function finalizeByeSitOut(gameId: string, teamId: string): Promise<void> {
  await prisma.game.update({
    where: { id: gameId },
    data: {
      homeTeamId: teamId,
      awayTeamId: null,
      status: GameStatus.FINAL,
      resultType: "FORFEIT_HOME_WINS",
      homeRuns: 1,
      awayRuns: 0,
      schedulePlaceholder: true,
    },
  });
  const { advanceBracketWinnerFromGame } = await import("@/lib/services/bracket-advance");
  await advanceBracketWinnerFromGame(gameId);
}

export type ApplyOba12PlacementInput = {
  bracketId: string;
  phase: Oba12PlacementPhase;
  byeTeamId?: string | null;
  matchups: Array<{ gameNumber: string; homeTeamId: string; awayTeamId: string }>;
};

export async function applyOba12Placement(input: ApplyOba12PlacementInput): Promise<void> {
  const board = await getOba12PlacementBoard(input.bracketId);
  if (!board) throw new Error("This bracket is not waiting for a 12-team redraw placement.");
  if (board.phase !== input.phase) {
    throw new Error(`Placement is for ${board.phase}, not ${input.phase}.`);
  }

  const remaining = new Set(board.remaining.map((t) => t.id));
  const used = new Set<string>();
  const take = (id: string, label: string) => {
    if (!remaining.has(id)) throw new Error(`${label} is not among the remaining teams.`);
    if (used.has(id)) throw new Error("Each remaining team can only be placed once.");
    used.add(id);
  };

  const tournament = await prisma.bracket.findUnique({
    where: { id: input.bracketId },
    select: { tournament: { select: { hasPoolPlay: true } } },
  });
  const coinFlip = tournament?.tournament.hasPoolPlay === false;

  if (board.phase === "r5") {
    if (input.matchups.length !== 2) throw new Error("Round 5 needs two games.");
    for (const m of input.matchups) {
      take(m.homeTeamId, m.gameNumber);
      take(m.awayTeamId, m.gameNumber);
    }
    if (used.size !== 4) throw new Error("Place all four remaining teams.");
    for (const m of input.matchups) {
      const gid = await gameIdByNumber(input.bracketId, m.gameNumber);
      if (!gid) throw new Error(`Game ${m.gameNumber} is missing.`);
      await assignMatchup(gid, m.homeTeamId, m.awayTeamId, false, coinFlip);
    }
    return;
  }

  if (board.phase === "r6" && board.branch === "B") {
    if (!input.byeTeamId) throw new Error("Bracket B Round 6 needs a bye team.");
    take(input.byeTeamId, "Bye");
    const m = input.matchups[0];
    if (!m) throw new Error("Bracket B Round 6 needs Game 22B.");
    take(m.homeTeamId, m.gameNumber);
    take(m.awayTeamId, m.gameNumber);
    if (used.size !== 3) throw new Error("Place all three remaining teams.");

    const byeId = await gameIdByNumber(input.bracketId, OBA12_GAME.BYE_R6);
    if (!byeId) throw new Error("Round 6 bye slot is missing.");
    await finalizeByeSitOut(byeId, input.byeTeamId);

    const gid = await gameIdByNumber(input.bracketId, OBA12_GAME.G22B);
    if (!gid) throw new Error("Game 22B is missing.");
    await assignMatchup(gid, m.homeTeamId, m.awayTeamId, false, coinFlip);
  }
}
