import { BracketRoundType, BracketSetupMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { bracketLoserTeamId, bracketWinnerTeamId } from "./bracket-engine";

/** After a bracket game is FINAL, place winner into the next-round matchup (single elim + consolation). */
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

  const bracket = await prisma.bracket.findUnique({
    where: { id: game.bracketId },
    select: { setupMode: true },
  });
  if (bracket?.setupMode === BracketSetupMode.MANUAL) return;

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

  const nextRound = await prisma.bracketRound.findFirst({
    where: { bracketId, roundIndex: roundIndex + 1 },
  });
  if (!nextRound?.id) return;

  // Championship winner does not feed into the consolation bracket.
  if (
    match.bracketRound.roundType !== BracketRoundType.LOSERS &&
    nextRound.roundType === BracketRoundType.LOSERS
  ) {
    return;
  }

  const parentMatchIdx = Math.floor(m / 2);
  const homeSlot = m % 2 === 0;

  const childMatch = await prisma.bracketMatch.findUnique({
    where: {
      bracketRoundId_matchIndex: { bracketRoundId: nextRound.id, matchIndex: parentMatchIdx },
    },
  });
  if (!childMatch?.gameId) return;

  await prisma.game.update({
    where: { id: childMatch.gameId },
    data: homeSlot ? { homeTeamId: winner } : { awayTeamId: winner },
  });
}

/**
 * After a winners-bracket round 0 game is FINAL, place the loser into the first consolation round
 * (same slot geometry as winner advancement).
 */
export async function advanceBracketLoserFromWinnersRound0(gameId: string): Promise<void> {
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

  const bracket = await prisma.bracket.findUnique({
    where: { id: game.bracketId },
    select: { setupMode: true, consolationEnabled: true, entryTeamCount: true },
  });
  if (!bracket?.consolationEnabled || bracket.setupMode === BracketSetupMode.MANUAL) return;

  const n = bracket.entryTeamCount;
  if (n < 4) return;

  const loser = bracketLoserTeamId(game);
  if (!loser) return;

  const match = await prisma.bracketMatch.findFirst({
    where: { gameId },
    include: { bracketRound: true },
  });
  if (!match) return;

  if (match.bracketRound.roundIndex !== 0) return;
  if (match.bracketRound.roundType !== BracketRoundType.WINNERS) return;

  const firstLosersRoundIndex = Math.log2(n) | 0;

  const nextRound = await prisma.bracketRound.findFirst({
    where: { bracketId: match.bracketRound.bracketId, roundIndex: firstLosersRoundIndex },
  });
  if (!nextRound?.id) return;

  const m = match.matchIndex;
  const parentMatchIdx = Math.floor(m / 2);
  const homeSlot = m % 2 === 0;

  const childMatch = await prisma.bracketMatch.findUnique({
    where: {
      bracketRoundId_matchIndex: { bracketRoundId: nextRound.id, matchIndex: parentMatchIdx },
    },
  });
  if (!childMatch?.gameId) return;

  await prisma.game.update({
    where: { id: childMatch.gameId },
    data: homeSlot ? { homeTeamId: loser } : { awayTeamId: loser },
  });
}
