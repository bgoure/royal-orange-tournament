/**
 * Admin redraw placement for the 13-team OBA double-elim map.
 * Suggestions follow RP5.2 + rematch-avoid; admin may override any seat.
 */

import { GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  aliveTeamIds,
  bracketWinnerTeamId,
} from "@/lib/services/bracket-engine";
import {
  applyImplicitByeAwards,
  inferOba13ImplicitByes,
  OBA13_GAME,
  oba13EndgameBranch,
  suggestOba13OddRoundPairing,
  type Oba13EndgameBranch,
  type Oba13PairingSuggestion,
} from "@/lib/services/oba-de-13";
import { meetingKey } from "@/lib/services/rematch-aware-pairing";
import { coinFlipHomeAwaySeats } from "@/lib/services/bracket-home-coin-flip";

export type Oba13PlacementTeam = { id: string; name: string };

export type Oba13PlacementPhase = "r5" | "r6" | "r7";

export type Oba13PlacementBoard = {
  bracketId: string;
  phase: Oba13PlacementPhase;
  branch: Oba13EndgameBranch | null;
  remaining: Oba13PlacementTeam[];
  suggestion: Oba13PairingSuggestion;
  eligibleByeTeamIds: string[];
  /** Game numbers the admin must fill this phase. */
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

function sitOutTeam(g: GameLite | undefined): string | null {
  if (!g) return null;
  const bye = g.bracketMatch?.awayIsBye || g.bracketMatch?.homeIsBye;
  if (!bye) return g.homeTeamId ?? g.awayTeamId;
  return g.bracketMatch?.homeIsBye ? g.awayTeamId : g.homeTeamId;
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

function named(ids: string[], names: Map<string, string>): Oba13PlacementTeam[] {
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

function entrantsAndAlive(games: GameLite[]): { entrants: string[]; alive: string[] } {
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
  return { entrants: ids, alive };
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
  const implicit = inferOba13ImplicitByes(games, (num) => winnerOfNum(games, num));
  const candidates = applyImplicitByeAwards(raw, implicit, currentRoundIndex);
  const meetings = await priorMeetings(bracketId);
  return suggestOba13OddRoundPairing(teamIds, candidates, gamesForRp73, meetings);
}

export async function getOba13PlacementBoard(bracketId: string): Promise<Oba13PlacementBoard | null> {
  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    select: { id: true, presetKey: true },
  });
  if (bracket?.presetKey !== "oba_de_13") return null;

  const games = await loadGames(bracketId);
  const names = teamMap(games);
  const { alive } = entrantsAndAlive(games);

  if (!allFinal(games, [OBA13_GAME.G18, OBA13_GAME.G19, OBA13_GAME.G20])) return null;

  const r5Nums = [OBA13_GAME.BYE_R5, OBA13_GAME.G21, OBA13_GAME.G22];
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
      note: "Round 5: 5 teams remain. RP5.2 bye + two games. Confirm or override the suggestion.",
    };
  }

  if (!allFinal(games, [OBA13_GAME.G21, OBA13_GAME.G22])) return null;

  const afterR5 = aliveTeamIds({
    format: "DOUBLE_ELIMINATION",
    entrantTeamIds: alive,
    games,
  });
  const branch = oba13EndgameBranch(afterR5.length);
  if (!branch) return null;

  if (branch === "A") {
    const r6Nums = [OBA13_GAME.BYE_R6, OBA13_GAME.G23A];
    if (!seatsReady(games, r6Nums)) {
      const suggestion = await suggestionFor(bracketId, afterR5, 5);
      return {
        bracketId,
        phase: "r6",
        branch: "A",
        remaining: named(afterR5, names),
        suggestion,
        eligibleByeTeamIds: suggestion.eligibleByeTeamIds,
        targetGameNumbers: r6Nums,
        note: "Bracket A (3 teams). RP5.2 bye + Game 23A. Confirm or override.",
      };
    }
    if (!isFinal(byNumber(games, OBA13_GAME.G23A))) return null;

    const afterR6 = aliveTeamIds({
      format: "DOUBLE_ELIMINATION",
      entrantTeamIds: afterR5,
      games,
    });
    if (afterR6.length === 3) {
      const r7Nums = [OBA13_GAME.BYE_R7, OBA13_GAME.G24A];
      if (!seatsReady(games, r7Nums) || byNumber(games, OBA13_GAME.G24A)?.homeTeamId == null) {
        const suggestion = await suggestionFor(bracketId, afterR6, 6);
        return {
          bracketId,
          phase: "r7",
          branch: "A",
          remaining: named(afterR6, names),
          suggestion,
          eligibleByeTeamIds: suggestion.eligibleByeTeamIds,
          targetGameNumbers: r7Nums,
          note: "Bracket A still has 3 teams. Round 6 bye team cannot sit again. Place the Round 7 bye and Game 24A.",
        };
      }
    }
    return null;
  }

  const r6b = [OBA13_GAME.G23B, OBA13_GAME.G24B];
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
      note: "Bracket B (4 teams, all one loss). Pair to avoid rematches. Confirm or override.",
    };
  }
  return null;
}

export async function listOba13PlacementBoards(tournamentId: string): Promise<Oba13PlacementBoard[]> {
  const brackets = await prisma.bracket.findMany({
    where: { tournamentId, presetKey: "oba_de_13" },
    select: { id: true },
  });
  const boards: Oba13PlacementBoard[] = [];
  for (const b of brackets) {
    const board = await getOba13PlacementBoard(b.id);
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

export type ApplyOba13PlacementInput = {
  bracketId: string;
  phase: Oba13PlacementPhase;
  byeTeamId?: string | null;
  matchups: Array<{ gameNumber: string; homeTeamId: string; awayTeamId: string }>;
};

export async function applyOba13Placement(input: ApplyOba13PlacementInput): Promise<void> {
  const board = await getOba13PlacementBoard(input.bracketId);
  if (!board) throw new Error("This bracket is not waiting for a 13-team redraw placement.");
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
    if (!input.byeTeamId) throw new Error("Round 5 needs a bye team.");
    take(input.byeTeamId, "Bye");
    if (input.matchups.length !== 2) throw new Error("Round 5 needs two games.");
    for (const m of input.matchups) {
      take(m.homeTeamId, m.gameNumber);
      take(m.awayTeamId, m.gameNumber);
    }
    if (used.size !== 5) throw new Error("Place all five remaining teams.");

    const byeId = await gameIdByNumber(input.bracketId, OBA13_GAME.BYE_R5);
    if (!byeId) throw new Error("Round 5 bye slot is missing.");
    await finalizeByeSitOut(byeId, input.byeTeamId);

    for (const m of input.matchups) {
      const gid = await gameIdByNumber(input.bracketId, m.gameNumber);
      if (!gid) throw new Error(`Game ${m.gameNumber} is missing.`);
      await assignMatchup(gid, m.homeTeamId, m.awayTeamId, false, coinFlip);
    }
    return;
  }

  if (board.phase === "r6" && board.branch === "A") {
    if (!input.byeTeamId) throw new Error("Bracket A Round 6 needs a bye team.");
    take(input.byeTeamId, "Bye");
    const m = input.matchups[0];
    if (!m) throw new Error("Bracket A Round 6 needs Game 23A.");
    take(m.homeTeamId, m.gameNumber);
    take(m.awayTeamId, m.gameNumber);
    if (used.size !== 3) throw new Error("Place all three remaining teams.");

    const byeId = await gameIdByNumber(input.bracketId, OBA13_GAME.BYE_R6);
    if (!byeId) throw new Error("Round 6 bye slot is missing.");
    await finalizeByeSitOut(byeId, input.byeTeamId);

    const gid = await gameIdByNumber(input.bracketId, OBA13_GAME.G23A);
    if (!gid) throw new Error("Game 23A is missing.");
    await assignMatchup(gid, m.homeTeamId, m.awayTeamId, false, coinFlip);
    return;
  }

  if (board.phase === "r6" && board.branch === "B") {
    if (input.matchups.length !== 2) throw new Error("Bracket B Round 6 needs two games.");
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

  if (board.phase === "r7") {
    if (!input.byeTeamId) throw new Error("Round 7 needs a bye team.");
    take(input.byeTeamId, "Bye");
    const m = input.matchups[0];
    if (!m) throw new Error("Round 7 needs Game 24A.");
    take(m.homeTeamId, m.gameNumber);
    take(m.awayTeamId, m.gameNumber);
    if (used.size !== 3) throw new Error("Place all three remaining teams.");

    const byeId = await gameIdByNumber(input.bracketId, OBA13_GAME.BYE_R7);
    if (!byeId) throw new Error("Round 7 bye slot is missing.");
    await finalizeByeSitOut(byeId, input.byeTeamId);

    const gid = await gameIdByNumber(input.bracketId, OBA13_GAME.G24A);
    if (!gid) throw new Error("Game 24A is missing.");
    await assignMatchup(gid, m.homeTeamId, m.awayTeamId, false, coinFlip);
  }
}

export { sitOutTeam };
