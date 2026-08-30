/**
 * Pure helpers for the 12-team OBA double-elim draw map.
 * Rounds 1–4 are fixed feeders (W10 sits Round 3 with no bye card).
 * Round 5 is an open 4-team rematch-avoid redraw.
 * After Round 5: 2 remain → Bracket A; 3 remain (all 1-loss) → Bracket B.
 */

import {
  applyImplicitByeAwards,
  suggestOba13OddRoundPairing,
  type ImplicitByeAward,
  type Oba13PairingSuggestion,
} from "@/lib/services/oba-de-13";
import {
  bracketLoserTeamId,
  bracketLossCountsFromGames,
  bracketWinnerTeamId,
} from "@/lib/services/bracket-engine";

export const OBA12_GAME = {
  G1: "1",
  G2: "2",
  G3: "3",
  G4: "4",
  G5: "5",
  G6: "6",
  G7: "7",
  G8: "8",
  G9: "9",
  G10: "10",
  G11: "11",
  G12: "12",
  G13: "13",
  G14: "14",
  G15: "15",
  G16: "16",
  G17: "17",
  G18: "18",
  G19: "19",
  G20: "20",
  G21: "21",
  G22A: "22A",
  G23A: "23A",
  G22B: "22B",
  G23B: "23B",
  BYE_R6: "R6 Bye",
} as const;

export type Oba12EndgameBranch = "A" | "B";

/** 2 remaining → Bracket A; 3 remaining (all 1-loss) → Bracket B. */
export function oba12EndgameBranch(aliveCount: number): Oba12EndgameBranch | null {
  if (aliveCount === 2) return "A";
  if (aliveCount === 3) return "B";
  return null;
}

export const OBA12_BRANCH_A_NUMBERS = [OBA12_GAME.G22A, OBA12_GAME.G23A] as const;

export const OBA12_BRANCH_B_NUMBERS = [
  OBA12_GAME.BYE_R6,
  OBA12_GAME.G22B,
  OBA12_GAME.G23B,
] as const;

export function oba12GamesForUnusedBranch(branchUsed: Oba12EndgameBranch): readonly string[] {
  return branchUsed === "A" ? OBA12_BRANCH_B_NUMBERS : OBA12_BRANCH_A_NUMBERS;
}

const OBA12_BRANCH_A_SET = new Set<string>(OBA12_BRANCH_A_NUMBERS);
const OBA12_BRANCH_B_SET = new Set<string>(OBA12_BRANCH_B_NUMBERS);

export function isOba12AlternateEndgameSlot(
  aNumber: string | null | undefined,
  bNumber: string | null | undefined,
): boolean {
  if (!aNumber || !bNumber || aNumber === bNumber) return false;
  const aOnA = OBA12_BRANCH_A_SET.has(aNumber);
  const aOnB = OBA12_BRANCH_B_SET.has(aNumber);
  const bOnA = OBA12_BRANCH_A_SET.has(bNumber);
  const bOnB = OBA12_BRANCH_B_SET.has(bNumber);
  return (aOnA && bOnB) || (aOnB && bOnA);
}

export function isOba12SitOutGameNumber(n: string | null | undefined): boolean {
  return n === OBA12_GAME.BYE_R6;
}

export function oba12EndgameBranchForGameNumber(
  n: string | null | undefined,
): Oba12EndgameBranch | null {
  const num = n?.trim() ?? "";
  if (OBA12_BRANCH_A_SET.has(num)) return "A";
  if (OBA12_BRANCH_B_SET.has(num)) return "B";
  return null;
}

export const OBA12_ROUND_5_REDRAW_NOTE =
  "Losers of games 17 and 18 have been eliminated. 4 teams remain (W17, W18, W19, L19). Pair avoiding previous matchups where possible; otherwise a draw determines pairings.";

export function oba12PublicEndgameMode(
  games: { gameNumber?: string | null }[],
): "placeholder" | Oba12EndgameBranch {
  let hasA = false;
  let hasB = false;
  for (const g of games) {
    const branch = oba12EndgameBranchForGameNumber(g.gameNumber);
    if (branch === "A") hasA = true;
    if (branch === "B") hasB = true;
  }
  if (hasA && !hasB) return "A";
  if (hasB && !hasA) return "B";
  return "placeholder";
}

/**
 * Structural sit-out on the 12-team map:
 * Winner of Game 10 sits Round 3 (index 2) and plays Game 19.
 */
export function inferOba12ImplicitByes(
  games: {
    gameNumber: string | null;
    homeTeamId: string | null;
    status: string;
    resultType: string;
    awayTeamId: string | null;
    homeRuns: number | null;
    awayRuns: number | null;
  }[],
  winnerOf: (gameNumber: string) => string | null,
): ImplicitByeAward[] {
  const awards: ImplicitByeAward[] = [];
  const w10 = winnerOf(OBA12_GAME.G10);
  if (w10) awards.push({ teamId: w10, roundIndex: 2 });
  return awards;
}

export { applyImplicitByeAwards, suggestOba13OddRoundPairing };
export type { ImplicitByeAward, Oba13PairingSuggestion };

export type Oba12RedrawPoolTeam = {
  teamId: string;
  name: string;
  losses: number;
  how: string;
};

export type Oba12Round5RedrawPool = {
  teams: Oba12RedrawPoolTeam[];
  waitingOn: string[];
};

type RedrawPoolGame = {
  gameNumber?: string | null;
  status: string;
  resultType: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeRuns: number | null;
  awayRuns: number | null;
  homeTeam?: { name: string } | null;
  awayTeam?: { name: string } | null;
};

function byGameNumber<T extends { gameNumber?: string | null }>(
  games: T[],
  num: string,
): T | undefined {
  return games.find((g) => (g.gameNumber?.trim() ?? "") === num);
}

function isFinalGame(g: { status: string } | undefined): boolean {
  return g?.status === "FINAL";
}

function nameForTeam(games: RedrawPoolGame[], teamId: string): string {
  for (const g of games) {
    if (g.homeTeamId === teamId && g.homeTeam?.name?.trim()) return g.homeTeam.name.trim();
    if (g.awayTeamId === teamId && g.awayTeam?.name?.trim()) return g.awayTeam.name.trim();
  }
  return "TBD";
}

function r5RedrawSeatsFilled(games: RedrawPoolGame[]): boolean {
  const g20 = byGameNumber(games, OBA12_GAME.G20);
  const g21 = byGameNumber(games, OBA12_GAME.G21);
  if (!g20 && !g21) return false;
  return Boolean(g20?.homeTeamId && g20?.awayTeamId && g21?.homeTeamId && g21?.awayTeamId);
}

function placedOnRound5(games: RedrawPoolGame[]): Set<string> {
  const ids = new Set<string>();
  for (const num of [OBA12_GAME.G20, OBA12_GAME.G21]) {
    const g = byGameNumber(games, num);
    if (g?.homeTeamId) ids.add(g.homeTeamId);
    if (g?.awayTeamId) ids.add(g.awayTeamId);
  }
  return ids;
}

/**
 * Teams still alive after Round 4 who are not yet seated in Round 5.
 * Shown under the Round 5 cards until G20/G21 are assigned.
 */
export function oba12Round5RedrawPool(games: RedrawPoolGame[]): Oba12Round5RedrawPool | null {
  const g17 = byGameNumber(games, OBA12_GAME.G17);
  const g18 = byGameNumber(games, OBA12_GAME.G18);
  const g19 = byGameNumber(games, OBA12_GAME.G19);
  if (!g17 && !g18 && !g19) return null;
  if (r5RedrawSeatsFilled(games)) return null;

  const r4Final = [g17, g18, g19].some((g) => isFinalGame(g));
  if (!r4Final) return null;

  const waitingOn: string[] = [];
  const teams: Oba12RedrawPoolTeam[] = [];
  const losses = bracketLossCountsFromGames(games.filter((g) => g.status === "FINAL"));
  const placed = placedOnRound5(games);

  const push = (teamId: string | null, how: string) => {
    if (!teamId || placed.has(teamId) || teams.some((t) => t.teamId === teamId)) return;
    teams.push({
      teamId,
      name: nameForTeam(games, teamId),
      losses: losses.get(teamId) ?? 0,
      how,
    });
  };

  if (isFinalGame(g17)) push(bracketWinnerTeamId(g17!), "Winner of Game 17");
  else if (g17) waitingOn.push("17");

  if (isFinalGame(g18)) push(bracketWinnerTeamId(g18!), "Winner of Game 18");
  else if (g18) waitingOn.push("18");

  if (isFinalGame(g19)) {
    push(bracketWinnerTeamId(g19!), "Winner of Game 19");
    push(bracketLoserTeamId(g19!), "Loser of Game 19");
  } else if (g19) waitingOn.push("19");

  if (teams.length === 0 && waitingOn.length === 0) return null;
  teams.sort((a, b) => a.losses - b.losses || a.name.localeCompare(b.name));
  return { teams, waitingOn };
}
