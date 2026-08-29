/**
 * Pure helpers for the 13-team OBA double-elim draw map.
 * Rounds 1–4 are fixed feeders; Round 5+ is a redraw with Bracket A (3 remain) or B (4 remain).
 */

import {
  selectObaByeRecipient,
  type ObaByeCandidate,
} from "@/lib/services/oba-bye-award";
import {
  pairTeamsAvoidingRematches,
  type RematchPairingResult,
} from "@/lib/services/rematch-aware-pairing";
import type { StandingsGameInput } from "@/lib/services/standings/standings-engine";

export const OBA13_GAME = {
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
  G22: "22",
  G23A: "23A",
  G24A: "24A",
  G25A: "25A",
  G23B: "23B",
  G24B: "24B",
  G25B: "25B",
  BYE_R5: "R5 Bye",
  BYE_R6: "R6 Bye",
  BYE_R7: "R7 Bye",
} as const;

export type Oba13EndgameBranch = "A" | "B";

export type ImplicitByeAward = {
  teamId: string;
  /** BracketRound.roundIndex where the sit-out happened. */
  roundIndex: number;
};

/** 3 remaining → Bracket A; 4 remaining (all 1-loss) → Bracket B. */
export function oba13EndgameBranch(aliveCount: number): Oba13EndgameBranch | null {
  if (aliveCount === 3) return "A";
  if (aliveCount === 4) return "B";
  return null;
}

export const OBA13_BRANCH_A_NUMBERS = [
  OBA13_GAME.BYE_R6,
  OBA13_GAME.G23A,
  OBA13_GAME.BYE_R7,
  OBA13_GAME.G24A,
  OBA13_GAME.G25A,
] as const;

export const OBA13_BRANCH_B_NUMBERS = [
  OBA13_GAME.G23B,
  OBA13_GAME.G24B,
  OBA13_GAME.G25B,
] as const;

export function oba13GamesForUnusedBranch(branchUsed: Oba13EndgameBranch): readonly string[] {
  return branchUsed === "A" ? OBA13_BRANCH_B_NUMBERS : OBA13_BRANCH_A_NUMBERS;
}

const OBA13_BRANCH_A_SET = new Set<string>(OBA13_BRANCH_A_NUMBERS);
const OBA13_BRANCH_B_SET = new Set<string>(OBA13_BRANCH_B_NUMBERS);

/** True when both numbers are 13-team endgame slots that cannot both be played. */
export function isOba13AlternateEndgameSlot(
  aNumber: string | null | undefined,
  bNumber: string | null | undefined,
): boolean {
  if (!aNumber || !bNumber || aNumber === bNumber) return false;
  const aOnA = OBA13_BRANCH_A_SET.has(aNumber);
  const aOnB = OBA13_BRANCH_B_SET.has(aNumber);
  const bOnA = OBA13_BRANCH_A_SET.has(bNumber);
  const bOnB = OBA13_BRANCH_B_SET.has(bNumber);
  return (aOnA && bOnB) || (aOnB && bOnA);
}

export function isOba13SitOutGameNumber(n: string | null | undefined): boolean {
  return n === OBA13_GAME.BYE_R5 || n === OBA13_GAME.BYE_R6 || n === OBA13_GAME.BYE_R7;
}

/** Bracket A (3 remain) vs B (4 remain) for R6–R8 game numbers. */
export function oba13EndgameBranchForGameNumber(
  n: string | null | undefined,
): Oba13EndgameBranch | null {
  const num = n?.trim() ?? "";
  if (OBA13_BRANCH_A_SET.has(num)) return "A";
  if (OBA13_BRANCH_B_SET.has(num)) return "B";
  return null;
}

export const OBA13_ROUND_5_REDRAW_NOTE =
  "Losers of games 18 and 19 have been eliminated. 5 teams remain, one of which is undefeated. If the undefeated team is 4-0, they get the bye. Otherwise bye is determined in accordance with RP5. The remaining 4 teams will be paired avoiding previous match ups where possible, otherwise a draw will be held to determine pairings.";

export function oba13SitOutByeNote(
  games: {
    gameNumber?: string | null;
    homeTeam?: { name: string } | null;
    awayTeam?: { name: string } | null;
  }[],
): string | null {
  const sit = games.filter((g) => isOba13SitOutGameNumber(g.gameNumber));
  if (sit.length === 0) return null;
  const names = sit
    .map((g) => g.homeTeam?.name ?? g.awayTeam?.name)
    .filter((n): n is string => !!n && n.trim().length > 0);
  if (names.length === 0) return "Bye: unassigned";
  return `Bye: ${names.join(", ")}`;
}

/**
 * Public tree: both A and B stay visible (placeholder) until the unused branch
 * is cancelled after Round 5. Then only the live branch remains.
 */
export function oba13PublicEndgameMode(
  games: { gameNumber?: string | null }[],
): "placeholder" | Oba13EndgameBranch {
  let hasA = false;
  let hasB = false;
  for (const g of games) {
    const branch = oba13EndgameBranchForGameNumber(g.gameNumber);
    if (branch === "A") hasA = true;
    if (branch === "B") hasB = true;
  }
  if (hasA && !hasB) return "A";
  if (hasB && !hasA) return "B";
  return "placeholder";
}

/** RP5.2 n.i + n.ii pool (admin may still override). */
export function rp52EligibleByeTeamIds(candidates: ObaByeCandidate[]): string[] {
  if (candidates.length === 0) return [];
  let pool = candidates.filter((c) => !c.hadByeInPreviousRound);
  if (pool.length === 0) pool = [...candidates];
  const minByes = Math.min(...pool.map((c) => c.byeCount));
  pool = pool.filter((c) => c.byeCount === minByes);
  return pool.map((c) => c.teamId);
}

export function applyImplicitByeAwards(
  candidates: ObaByeCandidate[],
  awards: ImplicitByeAward[],
  currentRoundIndex: number,
): ObaByeCandidate[] {
  if (awards.length === 0) return candidates;
  const extraCount = new Map<string, number>();
  const extraLast = new Map<string, number>();
  for (const a of awards) {
    extraCount.set(a.teamId, (extraCount.get(a.teamId) ?? 0) + 1);
    const prev = extraLast.get(a.teamId);
    if (prev == null || a.roundIndex > prev) extraLast.set(a.teamId, a.roundIndex);
  }
  const prevRound = currentRoundIndex - 1;
  return candidates.map((c) => {
    const add = extraCount.get(c.teamId) ?? 0;
    const last = extraLast.get(c.teamId);
    return {
      ...c,
      byeCount: c.byeCount + add,
      hadByeInPreviousRound: c.hadByeInPreviousRound || last === prevRound,
    };
  });
}

/**
 * Structural sit-outs on the 13-team map:
 * - Team 1 (G10 home at create) sits Round 1 (index 0)
 * - Winner of Game 1 sits Round 2 (index 1)
 * - Winner of Game 13 sits Round 4 (index 3)
 */
export function inferOba13ImplicitByes(
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
  const g10 = games.find((g) => g.gameNumber === OBA13_GAME.G10);
  if (g10?.homeTeamId) {
    awards.push({ teamId: g10.homeTeamId, roundIndex: 0 });
  }
  const w1 = winnerOf(OBA13_GAME.G1);
  if (w1) awards.push({ teamId: w1, roundIndex: 1 });
  const w13 = winnerOf(OBA13_GAME.G13);
  if (w13) awards.push({ teamId: w13, roundIndex: 3 });
  return awards;
}

export type Oba13PairingSuggestion = {
  byeTeamId: string | null;
  matchups: Array<[string, string]>;
  rematchCount: number;
  forced: boolean;
  eligibleByeTeamIds: string[];
};

export function suggestOba13OddRoundPairing(
  teamIds: string[],
  candidates: ObaByeCandidate[],
  gamesForRp73: StandingsGameInput[],
  priorMeetings: ReadonlySet<string>,
  rng: () => number = Math.random,
): Oba13PairingSuggestion {
  const eligibleByeTeamIds = rp52EligibleByeTeamIds(candidates);
  if (teamIds.length % 2 === 0) {
    const paired = pairTeamsAvoidingRematches(teamIds, priorMeetings, rng);
    return {
      byeTeamId: null,
      matchups: paired.matchups,
      rematchCount: paired.rematchCount,
      forced: paired.forced,
      eligibleByeTeamIds,
    };
  }
  const byeTeamId = selectObaByeRecipient(candidates, gamesForRp73, rng);
  const rest = teamIds.filter((id) => id !== byeTeamId);
  const paired: RematchPairingResult = pairTeamsAvoidingRematches(rest, priorMeetings, rng);
  return {
    byeTeamId,
    matchups: paired.matchups,
    rematchCount: paired.rematchCount,
    forced: paired.forced,
    eligibleByeTeamIds,
  };
}

export function seatsHaveTeams(
  games: { homeTeamId: string | null; awayTeamId: string | null; awayIsBye?: boolean }[],
): boolean {
  for (const g of games) {
    if (!g.homeTeamId) return false;
    if (!g.awayIsBye && !g.awayTeamId) return false;
  }
  return games.length > 0;
}
