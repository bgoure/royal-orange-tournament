import { prisma } from "@/lib/db";
import { bracketLoserTeamId, bracketWinnerTeamId } from "./bracket-engine";
import {
  meetingKey,
  pairTeamsAvoidingRematches,
  pickSeatAvoidingRematch,
} from "./rematch-aware-pairing";

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

/** Prior FINAL meetings in this bracket (unordered pair keys). */
async function loadBracketPriorMeetings(bracketId: string): Promise<Set<string>> {
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
    if (g.homeTeamId && g.awayTeamId) {
      set.add(meetingKey(g.homeTeamId, g.awayTeamId));
    }
  }
  return set;
}

/**
 * Place a team into a losers round. When avoidRematchesUntilForced is on and the round
 * has not started, clear open seats and re-pair everyone currently in the round.
 */
async function placeTeamIntoLosersRound(opts: {
  bracketId: string;
  losersRoundId: string;
  teamId: string;
  avoidRematches: boolean;
}): Promise<void> {
  const round = await prisma.bracketRound.findUnique({
    where: { id: opts.losersRoundId },
    include: {
      matches: {
        orderBy: { matchIndex: "asc" },
        include: { game: true },
      },
    },
  });
  if (!round) return;

  const seats = round.matches
    .filter((m) => m.gameId && m.game)
    .map((m) => ({
      gameId: m.gameId!,
      homeTeamId: m.game!.homeTeamId,
      awayTeamId: m.game!.awayTeamId,
      status: m.game!.status,
    }));
  if (seats.length === 0) return;

  // Already seated in this round — nothing to do.
  if (seats.some((s) => s.homeTeamId === opts.teamId || s.awayTeamId === opts.teamId)) {
    return;
  }

  const roundStarted = seats.some((s) => s.status === "LIVE" || s.status === "FINAL");
  const prior = opts.avoidRematches ? await loadBracketPriorMeetings(opts.bracketId) : new Set<string>();

  if (!opts.avoidRematches || roundStarted) {
    if (opts.avoidRematches && roundStarted) {
      const pick = pickSeatAvoidingRematch(opts.teamId, seats, prior);
      if (!pick) return;
      await prisma.game.update({
        where: { id: pick.gameId },
        data: pick.side === "home" ? { homeTeamId: opts.teamId } : { awayTeamId: opts.teamId },
      });
      return;
    }
    // Classic fixed: first open seat by match order
    for (const s of seats) {
      if (s.homeTeamId == null) {
        await prisma.game.update({ where: { id: s.gameId }, data: { homeTeamId: opts.teamId } });
        return;
      }
      if (s.awayTeamId == null) {
        await prisma.game.update({ where: { id: s.gameId }, data: { awayTeamId: opts.teamId } });
        return;
      }
    }
    return;
  }

  // Rematch-aware full redraw for unstarted round
  const teamIds = new Set<string>();
  for (const s of seats) {
    if (s.homeTeamId) teamIds.add(s.homeTeamId);
    if (s.awayTeamId) teamIds.add(s.awayTeamId);
  }
  teamIds.add(opts.teamId);

  for (const s of seats) {
    await prisma.game.update({
      where: { id: s.gameId },
      data: { homeTeamId: null, awayTeamId: null },
    });
  }

  const pairing = pairTeamsAvoidingRematches([...teamIds], prior);
  let gameIdx = 0;
  for (const [home, away] of pairing.matchups) {
    const gameId = seats[gameIdx]?.gameId;
    if (!gameId) break;
    await prisma.game.update({
      where: { id: gameId },
      data: { homeTeamId: home, awayTeamId: away },
    });
    gameIdx += 1;
  }
  if (pairing.byeTeamId) {
    const gameId = seats[gameIdx]?.gameId;
    if (gameId) {
      await prisma.game.update({
        where: { id: gameId },
        data: { homeTeamId: pairing.byeTeamId, awayTeamId: null },
      });
    }
  }
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

  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    select: { format: true, avoidRematchesUntilForced: true },
  });

  if (roundType === "LOSERS") {
    await placeTeamInNextLosersSlot(
      bracketId,
      roundIndex,
      m,
      winner,
      bracket?.avoidRematchesUntilForced === true,
    );
    return;
  }

  await placeTeamInNextWinnersSlot(bracketId, roundIndex, m, winner);

  if (
    bracket?.format === "DOUBLE_ELIMINATION" ||
    bracket?.format === "TRIPLE_ELIMINATION"
  ) {
    const loser = bracketLoserTeamId(game);
    if (loser) {
      await dropLoserIntoLosersBracket(
        bracketId,
        roundIndex,
        m,
        loser,
        bracket.avoidRematchesUntilForced === true,
      );
    }
  }
}

async function placeTeamInNextLosersSlot(
  bracketId: string,
  roundIndex: number,
  matchIndex: number,
  teamId: string,
  avoidRematches: boolean,
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

  if (avoidRematches) {
    await placeTeamIntoLosersRound({
      bracketId,
      losersRoundId: nextLosers.id,
      teamId,
      avoidRematches: true,
    });
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
  avoidRematches: boolean,
): Promise<void> {
  const firstLosers = await prisma.bracketRound.findFirst({
    where: { bracketId, roundType: "LOSERS" },
    orderBy: { roundIndex: "asc" },
    include: { matches: { orderBy: { matchIndex: "asc" }, include: { game: true } } },
  });
  if (!firstLosers) return;

  if (avoidRematches) {
    await placeTeamIntoLosersRound({
      bracketId,
      losersRoundId: firstLosers.id,
      teamId: loserTeamId,
      avoidRematches: true,
    });
    return;
  }

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
  if (!data) {
    // Slot full — fall back to first open seat in the round
    await placeTeamIntoLosersRound({
      bracketId,
      losersRoundId: firstLosers.id,
      teamId: loserTeamId,
      avoidRematches: false,
    });
    return;
  }
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
