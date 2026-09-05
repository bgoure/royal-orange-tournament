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
import {
  bracketLoserTeamId,
  bracketLossCountsFromGames,
  bracketWinnerTeamId,
} from "@/lib/services/bracket-engine";
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

export type Oba13RedrawPoolTeam = {
  teamId: string;
  name: string;
  losses: number;
  how: string;
};

export type Oba13Round5RedrawPool = {
  teams: Oba13RedrawPoolTeam[];
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

function isFinalGame(g: { status?: string | null } | undefined): boolean {
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
  const bye = byGameNumber(games, OBA13_GAME.BYE_R5);
  const g21 = byGameNumber(games, OBA13_GAME.G21);
  const g22 = byGameNumber(games, OBA13_GAME.G22);
  if (!bye && !g21 && !g22) return false;
  return Boolean(
    bye?.homeTeamId &&
      g21?.homeTeamId &&
      g21?.awayTeamId &&
      g22?.homeTeamId &&
      g22?.awayTeamId,
  );
}

function placedOnRound5(games: RedrawPoolGame[]): Set<string> {
  const ids = new Set<string>();
  for (const num of [OBA13_GAME.BYE_R5, OBA13_GAME.G21, OBA13_GAME.G22]) {
    const g = byGameNumber(games, num);
    if (g?.homeTeamId) ids.add(g.homeTeamId);
    if (g?.awayTeamId) ids.add(g.awayTeamId);
  }
  return ids;
}

/**
 * Teams still alive after Round 4 who are not yet seated in Round 5.
 * Shown under the Round 5 cards until G21/G22/the bye are assigned.
 */
export function oba13Round5RedrawPool(games: RedrawPoolGame[]): Oba13Round5RedrawPool | null {
  const g18 = byGameNumber(games, OBA13_GAME.G18);
  const g19 = byGameNumber(games, OBA13_GAME.G19);
  const g20 = byGameNumber(games, OBA13_GAME.G20);
  if (!g18 && !g19 && !g20) return null;
  if (r5RedrawSeatsFilled(games)) return null;

  const r4Final = [g18, g19, g20].some((g) => isFinalGame(g));
  if (!r4Final) return null;

  const waitingOn: string[] = [];
  const teams: Oba13RedrawPoolTeam[] = [];
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

  const g13 = byGameNumber(games, OBA13_GAME.G13);
  if (isFinalGame(g13)) push(bracketWinnerTeamId(g13!), "Sat out Round 4");

  if (isFinalGame(g18)) push(bracketWinnerTeamId(g18!), "Winner of Game 18");
  else if (g18) waitingOn.push("18");

  if (isFinalGame(g19)) push(bracketWinnerTeamId(g19!), "Winner of Game 19");
  else if (g19) waitingOn.push("19");

  if (isFinalGame(g20)) {
    push(bracketWinnerTeamId(g20!), "Winner of Game 20");
    push(bracketLoserTeamId(g20!), "Loser of Game 20");
  } else if (g20) waitingOn.push("20");

  if (teams.length === 0 && waitingOn.length === 0) return null;
  teams.sort((a, b) => a.losses - b.losses || a.name.localeCompare(b.name));
  return { teams, waitingOn };
}

export type Oba13EndgameGame = {
  gameNumber?: string | null;
  status?: string;
  resultType?: string;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeRuns?: number | null;
  awayRuns?: number | null;
  homeTeam?: { name: string } | null;
  awayTeam?: { name: string } | null;
};

export type Oba13Round5Undefeated = {
  teamId: string;
  name: string;
  wins: number;
  losses: number;
  priorByeCount: number;
};

function winnerLookup(games: Oba13EndgameGame[]): (gameNumber: string) => string | null {
  return (num: string) => {
    const g = byGameNumber(games, num);
    if (!g || g.status !== "FINAL") return null;
    return bracketWinnerTeamId({
      status: g.status ?? "",
      resultType: g.resultType ?? "REGULAR",
      homeTeamId: g.homeTeamId ?? null,
      awayTeamId: g.awayTeamId ?? null,
      homeRuns: g.homeRuns ?? null,
      awayRuns: g.awayRuns ?? null,
    });
  };
}

function implicitByeCountByTeam(games: Oba13EndgameGame[]): Map<string, number> {
  const awards = inferOba13ImplicitByes(
    games.map((g) => ({
      gameNumber: g.gameNumber ?? null,
      homeTeamId: g.homeTeamId ?? null,
      awayTeamId: g.awayTeamId ?? null,
      status: g.status ?? "SCHEDULED",
      resultType: g.resultType ?? "REGULAR",
      homeRuns: g.homeRuns ?? null,
      awayRuns: g.awayRuns ?? null,
    })),
    winnerLookup(games),
  );
  const counts = new Map<string, number>();
  for (const a of awards) {
    counts.set(a.teamId, (counts.get(a.teamId) ?? 0) + 1);
  }
  return counts;
}

function winCountsFromGames(games: Oba13EndgameGame[]): Map<string, number> {
  const wins = new Map<string, number>();
  for (const g of games) {
    if (g.status !== "FINAL") continue;
    const w = bracketWinnerTeamId({
      status: g.status ?? "",
      resultType: g.resultType ?? "REGULAR",
      homeTeamId: g.homeTeamId ?? null,
      awayTeamId: g.awayTeamId ?? null,
      homeRuns: g.homeRuns ?? null,
      awayRuns: g.awayRuns ?? null,
    });
    if (!w) continue;
    wins.set(w, (wins.get(w) ?? 0) + 1);
  }
  return wins;
}

/**
 * Undefeated team still alive after Round 4 has started (at least one of G18–G20 final).
 * `priorByeCount` uses implicit R1/R2/R4 sit-outs so a 3-0 (had a bye) is distinct from 4-0.
 */
export function oba13Round5Undefeated(games: Oba13EndgameGame[]): Oba13Round5Undefeated | null {
  const g18 = byGameNumber(games, OBA13_GAME.G18);
  const g19 = byGameNumber(games, OBA13_GAME.G19);
  const g20 = byGameNumber(games, OBA13_GAME.G20);
  if (![g18, g19, g20].some((g) => isFinalGame(g))) return null;

  const scored = games.filter((g) => g.status === "FINAL");
  const losses = bracketLossCountsFromGames(
    scored.map((g) => ({
      status: g.status ?? "",
      resultType: g.resultType ?? "REGULAR",
      homeTeamId: g.homeTeamId ?? null,
      awayTeamId: g.awayTeamId ?? null,
      homeRuns: g.homeRuns ?? null,
      awayRuns: g.awayRuns ?? null,
    })),
  );
  const wins = winCountsFromGames(games);
  const byeCounts = implicitByeCountByTeam(games);
  const seen = new Set<string>();
  for (const g of games) {
    if (g.homeTeamId) seen.add(g.homeTeamId);
    if (g.awayTeamId) seen.add(g.awayTeamId);
  }

  let best: Oba13Round5Undefeated | null = null;
  for (const teamId of seen) {
    const lossCount = losses.get(teamId) ?? 0;
    if (lossCount !== 0) continue;
    const winCount = wins.get(teamId) ?? 0;
    if (winCount < 3) continue;
    const row: Oba13Round5Undefeated = {
      teamId,
      name: nameForTeam(games as RedrawPoolGame[], teamId),
      wins: winCount,
      losses: lossCount,
      priorByeCount: byeCounts.get(teamId) ?? 0,
    };
    if (
      !best ||
      row.wins - row.priorByeCount > best.wins - best.priorByeCount ||
      (row.wins === best.wins && row.priorByeCount < best.priorByeCount)
    ) {
      best = row;
    }
  }
  return best;
}

/** 4-0 undefeated (no R1–R4 sit-out) — the only team labeled as the Round 5 bye. */
export function oba13Round5ByeTeam(games: Oba13EndgameGame[]): Oba13Round5Undefeated | null {
  const u = oba13Round5Undefeated(games);
  if (!u || u.losses !== 0 || u.priorByeCount !== 0 || u.wins < 4) return null;
  return u;
}

function r5GamesFinal(games: Oba13EndgameGame[]): boolean {
  const g21 = byGameNumber(games, OBA13_GAME.G21);
  const g22 = byGameNumber(games, OBA13_GAME.G22);
  return isFinalGame(g21) && isFinalGame(g22);
}

function aliveCountAmongEntrants(games: Oba13EndgameGame[]): number {
  const entrants = new Set<string>();
  for (const g of games) {
    if (g.status === "CANCELLED") continue;
    if (g.homeTeamId) entrants.add(g.homeTeamId);
    if (g.awayTeamId) entrants.add(g.awayTeamId);
  }
  const losses = bracketLossCountsFromGames(
    games
      .filter((g) => g.status === "FINAL")
      .map((g) => ({
        status: g.status ?? "",
        resultType: g.resultType ?? "REGULAR",
        homeTeamId: g.homeTeamId ?? null,
        awayTeamId: g.awayTeamId ?? null,
        homeRuns: g.homeRuns ?? null,
        awayRuns: g.awayRuns ?? null,
      })),
  );
  let n = 0;
  for (const id of entrants) {
    if ((losses.get(id) ?? 0) < 2) n += 1;
  }
  return n;
}

/**
 * Public tree: a known 4-0 locks Bracket A immediately. A 3-0 undefeated keeps
 * both boxes until G21 and G22 are final, then remaining-team count decides.
 * If the unused branch was already cancelled, that remaining branch wins.
 */
export function oba13PublicEndgameMode(
  games: Oba13EndgameGame[],
): "placeholder" | Oba13EndgameBranch {
  if (oba13Round5ByeTeam(games)) return "A";

  if (r5GamesFinal(games)) {
    const branch = oba13EndgameBranch(aliveCountAmongEntrants(games));
    if (branch) return branch;
  }

  let hasA = false;
  let hasB = false;
  for (const g of games) {
    if (g.status === "CANCELLED") continue;
    const branch = oba13EndgameBranchForGameNumber(g.gameNumber);
    if (branch === "A") hasA = true;
    if (branch === "B") hasB = true;
  }
  if (hasA && !hasB) return "A";
  if (hasB && !hasA) return "B";
  return "placeholder";
}

/** Empty-slot copy on Bracket A (OBA poster). */
export function oba13PlaceholderPrimary(
  toGameNumber: string | null | undefined,
  fromGameNumber: string | null | undefined,
): string | null {
  const to = toGameNumber?.trim() ?? "";
  const from = fromGameNumber?.trim() ?? "";
  if (to === OBA13_GAME.G23A && from === OBA13_GAME.BYE_R5) return "Round 5\nBye Team";
  if (to === OBA13_GAME.G23A) return null;
  if (to === OBA13_GAME.G24A && from === OBA13_GAME.BYE_R6) return "Round 6\nBye Team";
  if (to === OBA13_GAME.G24A && from === OBA13_GAME.G23A) return "Winner 23A";
  if (to === OBA13_GAME.G25A && from === OBA13_GAME.G24A) return "Winner 24A";
  if (to === OBA13_GAME.G25A && from === OBA13_GAME.BYE_R7) return "Round 7\nBye Team";
  return null;
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
