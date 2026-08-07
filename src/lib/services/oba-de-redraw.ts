/**
 * Resolve open OBA DE redraw / endgame slots after games finalize.
 * Uses alive-team counts, OBA bye awards, and rematch-aware pairing.
 */

import { prisma } from "@/lib/db";
import { aliveTeamIds, bracketLoserTeamId, bracketWinnerTeamId } from "@/lib/services/bracket-engine";
import { selectObaByeRecipient, type ObaByeCandidate } from "@/lib/services/oba-bye-award";
import { meetingKey, pairTeamsAvoidingRematches } from "@/lib/services/rematch-aware-pairing";
import type { StandingsGameInput } from "@/lib/services/standings/standings-engine";

function gameNum(g: { gameNumber: string | null }, fallback: string): string {
  return (g.gameNumber ?? fallback).trim();
}

async function loadBracketGames(bracketId: string) {
  return prisma.game.findMany({
    where: { bracketId },
    include: {
      bracketRound: true,
      bracketMatch: true,
    },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
  });
}

function priorMeetingsFromFinals(
  games: Awaited<ReturnType<typeof loadBracketGames>>,
): Set<string> {
  const set = new Set<string>();
  for (const g of games) {
    if (g.status !== "FINAL" || !g.homeTeamId || !g.awayTeamId) continue;
    set.add(meetingKey(g.homeTeamId, g.awayTeamId));
  }
  return set;
}

function lossesByTeam(games: Awaited<ReturnType<typeof loadBracketGames>>): Map<string, number> {
  const losses = new Map<string, number>();
  for (const g of games) {
    if (g.status !== "FINAL") continue;
    const loser = bracketLoserTeamId(g);
    if (!loser) continue;
    losses.set(loser, (losses.get(loser) ?? 0) + 1);
  }
  return losses;
}

function byeCountsApprox(
  games: Awaited<ReturnType<typeof loadBracketGames>>,
  teamIds: string[],
): Map<string, number> {
  /** Count structural byes (team assigned to a match alone) + open sit-outs we already awarded via empty opponent. */
  const counts = new Map<string, number>(teamIds.map((id) => [id, 0]));
  for (const g of games) {
    if (g.bracketMatch?.homeIsBye && g.awayTeamId) {
      counts.set(g.awayTeamId, (counts.get(g.awayTeamId) ?? 0) + 1);
    }
    if (g.bracketMatch?.awayIsBye && g.homeTeamId) {
      counts.set(g.homeTeamId, (counts.get(g.homeTeamId) ?? 0) + 1);
    }
  }
  // R1 bye team for 5/7 is placed directly into a later game without a bye flag — detect via game 4/5 home sitting from draw.
  return counts;
}

async function fillOpenMatch(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string,
): Promise<void> {
  await prisma.game.update({
    where: { id: gameId },
    data: {
      homeTeamId,
      awayTeamId,
      schedulePlaceholder: false,
      status: "SCHEDULED",
    },
  });
}

function findByGameNumber(
  games: Awaited<ReturnType<typeof loadBracketGames>>,
  num: string,
) {
  const n = num.toLowerCase();
  const exact = games.find((g) => gameNum(g, "").toLowerCase() === n);
  if (exact) return exact;
  // GF labels: "GF1", "GF2 (if necessary)"
  if (n.startsWith("gf")) {
    return games.find((g) => gameNum(g, "").toLowerCase().startsWith(n));
  }
  return undefined;
}

function standingsInputs(games: Awaited<ReturnType<typeof loadBracketGames>>): StandingsGameInput[] {
  return games
    .filter((g) => g.status === "FINAL" && g.homeTeamId && g.awayTeamId)
    .map((g) => ({
      homeTeamId: g.homeTeamId!,
      awayTeamId: g.awayTeamId!,
      homeRuns: g.homeRuns ?? 0,
      awayRuns: g.awayRuns ?? 0,
      status: "FINAL",
      resultType: g.resultType,
      homeDefensiveInnings: null,
      awayDefensiveInnings: null,
      homeOffensiveInnings: null,
      awayOffensiveInnings: null,
    }));
}

function entrantsFromGames(games: Awaited<ReturnType<typeof loadBracketGames>>): string[] {
  const ids = new Set<string>();
  for (const g of games) {
    if (g.homeTeamId) ids.add(g.homeTeamId);
    if (g.awayTeamId) ids.add(g.awayTeamId);
  }
  return [...ids];
}

function aliveInBracket(games: Awaited<ReturnType<typeof loadBracketGames>>): string[] {
  return aliveTeamIds({
    format: "DOUBLE_ELIMINATION",
    entrantTeamIds: entrantsFromGames(games),
    games: games.map((g) => ({
      status: g.status,
      resultType: g.resultType,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeRuns: g.homeRuns,
      awayRuns: g.awayRuns,
    })),
  });
}

async function resolveOba5(bracketId: string): Promise<void> {
  const games = await loadBracketGames(bracketId);
  const g5 = findByGameNumber(games, "5");
  const g6 = findByGameNumber(games, "6");
  const g7 = findByGameNumber(games, "7");
  const gf1 = findByGameNumber(games, "gf1");
  if (!g5 || !g6 || !g7 || !gf1) return;
  if (g5.status !== "FINAL" || g6.status !== "FINAL") return;

  const alive = aliveInBracket(games);
  if (alive.length < 2) return;

  const losses = lossesByTeam(games);
  const byes = byeCountsApprox(games, alive);

  // Fill G7 when open and 3 alive.
  if (
    g7.homeTeamId == null &&
    g7.awayTeamId == null &&
    alive.length === 3
  ) {
    const candidates: ObaByeCandidate[] = alive.map((teamId) => ({
      teamId,
      bracketLosses: losses.get(teamId) ?? 0,
      byeCount: byes.get(teamId) ?? 0,
      hadByeInPreviousRound: false,
    }));
    const byeTeamId = selectObaByeRecipient(candidates, standingsInputs(games));
    const pair = alive.filter((id) => id !== byeTeamId);
    if (pair.length === 2) {
      await fillOpenMatch(g7.id, pair[0]!, pair[1]!);
      // Stash bye team on GF1 home until G7 completes (placeholder seat).
      if (gf1.homeTeamId == null && gf1.awayTeamId == null) {
        await prisma.game.update({
          where: { id: gf1.id },
          data: { homeTeamId: byeTeamId, schedulePlaceholder: true },
        });
      }
    }
    return;
  }

  // After G7: place winner vs bye into GF1.
  if (g7.status === "FINAL" && (gf1.awayTeamId == null || gf1.homeTeamId == null || gf1.schedulePlaceholder)) {
    const winner = bracketWinnerTeamId(g7);
    if (!winner) return;
    const byeTeamId =
      gf1.homeTeamId && gf1.homeTeamId !== winner && gf1.homeTeamId !== g7.homeTeamId && gf1.homeTeamId !== g7.awayTeamId
        ? gf1.homeTeamId
        : gf1.awayTeamId && gf1.awayTeamId !== winner
          ? gf1.awayTeamId
          : alive.find((id) => id !== winner && id !== bracketLoserTeamId(g7)) ?? null;
    if (!byeTeamId) return;
    await fillOpenMatch(gf1.id, byeTeamId, winner);
  }
}

async function resolveOba7(bracketId: string): Promise<void> {
  const games = await loadBracketGames(bracketId);
  const g7 = findByGameNumber(games, "7");
  const g8 = findByGameNumber(games, "8");
  const g9 = findByGameNumber(games, "9");
  const g10 = findByGameNumber(games, "10");
  const g11 = findByGameNumber(games, "11");
  const gf1 = findByGameNumber(games, "gf1");
  if (!g7 || !g8 || !g9 || !g10 || !g11 || !gf1) return;
  if (g7.status !== "FINAL" || g8.status !== "FINAL" || g9.status !== "FINAL") return;

  const alive = aliveInBracket(games);
  if (alive.length !== 4) return;
  if (g10.homeTeamId != null || g11.homeTeamId != null) return;

  const paired = pairTeamsAvoidingRematches(alive, priorMeetingsFromFinals(games));
  if (paired.matchups.length < 2) return;
  const [m0, m1] = paired.matchups;
  if (!m0 || !m1) return;
  await fillOpenMatch(g10.id, m0[0], m0[1]);
  await fillOpenMatch(g11.id, m1[0], m1[1]);
}

async function resolveOba6(bracketId: string): Promise<void> {
  const games = await loadBracketGames(bracketId);
  const g4 = findByGameNumber(games, "4");
  const g5 = findByGameNumber(games, "5");
  const g6 = findByGameNumber(games, "6");
  const g7 = findByGameNumber(games, "7");
  const g8 = findByGameNumber(games, "8");
  if (!g4 || !g5 || !g6 || !g7 || !g8) return;
  if (g4.status !== "FINAL" || g5.status !== "FINAL" || g6.status !== "FINAL") return;
  if (g7.homeTeamId != null || g8.homeTeamId != null) return;

  const alive = aliveInBracket(games);
  const losses = lossesByTeam(games);
  const undefeated = alive.filter((id) => (losses.get(id) ?? 0) === 0);

  // Bracket A path intent: 4 alive → pair into G7/G8 with undefeated deferred when possible.
  // Bracket B: 5 alive → undefeated bye + rematch-avoid among 4.
  if (alive.length === 5 && undefeated.length >= 1) {
    const byeTeam = undefeated[0]!;
    const pool = alive.filter((id) => id !== byeTeam);
    const paired = pairTeamsAvoidingRematches(pool, priorMeetingsFromFinals(games));
    if (paired.matchups.length < 2) return;
    const [m0, m1] = paired.matchups;
    if (!m0 || !m1) return;
    await fillOpenMatch(g7.id, m0[0], m0[1]);
    await fillOpenMatch(g8.id, m1[0], m1[1]);
    return;
  }

  if (alive.length === 4) {
    const paired = pairTeamsAvoidingRematches(alive, priorMeetingsFromFinals(games));
    if (paired.matchups.length < 2) return;
    const [m0, m1] = paired.matchups;
    if (!m0 || !m1) return;
    await fillOpenMatch(g7.id, m0[0], m0[1]);
    await fillOpenMatch(g8.id, m1[0], m1[1]);
  }
}

/** After any OBA preset game finals, fill the next open redraw / endgame slots when ready. */
export async function maybeResolveObaPresetPairings(bracketId: string): Promise<void> {
  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    select: { presetKey: true },
  });
  const key = bracket?.presetKey;
  if (!key?.startsWith("oba_de_")) return;

  if (key === "oba_de_5") await resolveOba5(bracketId);
  else if (key === "oba_de_6") await resolveOba6(bracketId);
  else if (key === "oba_de_7") await resolveOba7(bracketId);
}
