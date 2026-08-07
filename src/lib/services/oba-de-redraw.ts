/**
 * Resolve open OBA DE redraw / endgame slots after games finalize.
 * Uses alive-team counts, OBA bye awards, and rematch-aware pairing.
 */

import { prisma } from "@/lib/db";
import { aliveTeamIds, bracketLoserTeamId } from "@/lib/services/bracket-engine";
import { meetingKey, pairTeamsAvoidingRematches } from "@/lib/services/rematch-aware-pairing";

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

/** After any OBA preset game finals, fill the next open redraw / endgame slots when ready. */
export async function maybeResolveObaPresetPairings(bracketId: string): Promise<void> {
  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    select: { presetKey: true },
  });
  const key = bracket?.presetKey;
  if (!key?.startsWith("oba_de_")) return;

  // oba_de_5 / oba_de_6 are fully feeder-wired seeded maps (no mid-bracket redraw).
  if (key === "oba_de_7") await resolveOba7(bracketId);
}
