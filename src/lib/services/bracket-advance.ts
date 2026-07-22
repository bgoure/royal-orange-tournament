import { prisma } from "@/lib/db";
import { bracketLoserTeamId, bracketWinnerTeamId } from "./bracket-engine";

async function placeTeamInNextWinnersSlot(
  bracketId: string,
  roundIndex: number,
  matchIndex: number,
  teamId: string,
): Promise<void> {
  const nextRound = await prisma.bracketRound.findFirst({
    where: { bracketId, roundIndex: roundIndex + 1 },
  });
  if (!nextRound?.id) return;

  const parentMatchIdx = Math.floor(matchIndex / 2);
  const homeSlot = matchIndex % 2 === 0;

  const childMatch = await prisma.bracketMatch.findUnique({
    where: {
      bracketRoundId_matchIndex: { bracketRoundId: nextRound.id, matchIndex: parentMatchIdx },
    },
  });
  if (!childMatch?.gameId) return;

  await prisma.game.update({
    where: { id: childMatch.gameId },
    data: homeSlot ? { homeTeamId: teamId } : { awayTeamId: teamId },
  });
}

/** After a bracket game is FINAL, place winner into the next-round matchup. */
export async function advanceBracketWinnerFromGame(gameId: string): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      bracketId: true,
      status: true,
      resultType: true,
      homeTeamId: true,
      awayTeamId: true,
      homeRuns: true,
      awayRuns: true,
    },
  });
  if (!game?.bracketId || game.status !== "FINAL") return;

  const winner = bracketWinnerTeamId(game);
  if (!winner) return;

  const match = await prisma.bracketMatch.findFirst({
    where: { gameId },
    include: { bracketRound: true },
  });
  if (!match) return;

  const roundIndex = match.bracketRound.roundIndex;
  const bracketId = match.bracketRound.bracketId;
  const m = match.matchIndex;
  const roundType = match.bracketRound.roundType;

  if (roundType === "LOSERS") {
    await placeTeamInNextLosersSlot(bracketId, roundIndex, m, winner);
    return;
  }

  await placeTeamInNextWinnersSlot(bracketId, roundIndex, m, winner);

  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    select: { format: true },
  });
  if (
    bracket?.format === "DOUBLE_ELIMINATION" ||
    bracket?.format === "TRIPLE_ELIMINATION"
  ) {
    const loser = bracketLoserTeamId(game);
    if (loser) {
      await dropLoserIntoLosersBracket(bracketId, roundIndex, m, loser);
    }
  }
}

async function placeTeamInNextLosersSlot(
  bracketId: string,
  roundIndex: number,
  matchIndex: number,
  teamId: string,
): Promise<void> {
  const nextLosers = await prisma.bracketRound.findFirst({
    where: {
      bracketId,
      roundType: "LOSERS",
      roundIndex: { gt: roundIndex },
    },
    orderBy: { roundIndex: "asc" },
  });
  if (!nextLosers) {
    // Losers final winner → grand final (last FINAL / winners final game)
    const grandFinal = await prisma.bracketRound.findFirst({
      where: { bracketId, roundType: "FINAL" },
      include: { matches: { orderBy: { matchIndex: "asc" }, take: 1 } },
    });
    const gfGameId = grandFinal?.matches[0]?.gameId;
    if (gfGameId) {
      await prisma.game.update({
        where: { id: gfGameId },
        data: { awayTeamId: teamId },
      });
    }
    return;
  }

  const parentMatchIdx = Math.floor(matchIndex / 2);
  const homeSlot = matchIndex % 2 === 0;
  const childMatch = await prisma.bracketMatch.findUnique({
    where: {
      bracketRoundId_matchIndex: {
        bracketRoundId: nextLosers.id,
        matchIndex: parentMatchIdx,
      },
    },
  });
  if (!childMatch?.gameId) return;
  await prisma.game.update({
    where: { id: childMatch.gameId },
    data: homeSlot ? { homeTeamId: teamId } : { awayTeamId: teamId },
  });
}

/** Drop a winners-bracket loser into the first available losers-bracket slot. */
async function dropLoserIntoLosersBracket(
  bracketId: string,
  winnersRoundIndex: number,
  winnersMatchIndex: number,
  loserTeamId: string,
): Promise<void> {
  const firstLosers = await prisma.bracketRound.findFirst({
    where: { bracketId, roundType: "LOSERS" },
    orderBy: { roundIndex: "asc" },
    include: { matches: { orderBy: { matchIndex: "asc" }, include: { game: true } } },
  });
  if (!firstLosers) return;

  // Map winners R0 match i → losers slot i (best-effort for v1)
  const targetIdx =
    winnersRoundIndex === 0
      ? Math.min(winnersMatchIndex, Math.max(0, firstLosers.matches.length - 1))
      : Math.min(
          Math.floor(winnersMatchIndex + winnersRoundIndex),
          Math.max(0, firstLosers.matches.length - 1),
        );

  const slot = firstLosers.matches[targetIdx];
  if (!slot?.gameId || !slot.game) return;

  const data =
    slot.game.homeTeamId == null
      ? { homeTeamId: loserTeamId }
      : slot.game.awayTeamId == null
        ? { awayTeamId: loserTeamId }
        : null;
  if (!data) return;
  await prisma.game.update({ where: { id: slot.gameId }, data });
}

/**
 * After round-0 teams are seeded, auto-advance sides that drew a BYE into the next round.
 * Championship rule for double-elim (documented): if the losers-bracket winner beats the
 * winners-bracket winner once in the grand final, they are champion — no forced rematch.
 */
export async function advanceByeWinnersInRound0(bracketId: string): Promise<void> {
  const round0 = await prisma.bracketRound.findFirst({
    where: { bracketId, roundIndex: 0 },
    include: {
      matches: {
        include: { game: true },
      },
    },
  });
  if (!round0) return;

  for (const match of round0.matches) {
    if (!match.game) continue;
    const homeBye = match.homeIsBye;
    const awayBye = match.awayIsBye;
    if (!homeBye && !awayBye) continue;
    if (homeBye && awayBye) continue;

    const winnerId = homeBye ? match.game.awayTeamId : match.game.homeTeamId;
    if (!winnerId) continue;

    await placeTeamInNextWinnersSlot(bracketId, 0, match.matchIndex, winnerId);

    // Mark bye game as FINAL with a forfeit so standings/UI stay consistent
    await prisma.game.update({
      where: { id: match.game.id },
      data: {
        status: "FINAL",
        resultType: homeBye ? "FORFEIT_AWAY_WINS" : "FORFEIT_HOME_WINS",
        homeRuns: homeBye ? 0 : 1,
        awayRuns: awayBye ? 0 : 1,
        schedulePlaceholder: false,
      },
    });
  }
}

/** @deprecated Consolation mini-bracket removed; kept as no-op for callers. */
export async function advanceBracketLoserFromWinnersRound0(): Promise<void> {}
