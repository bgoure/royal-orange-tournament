import { prisma } from "@/lib/db";
import { bracketLoserTeamId, bracketWinnerTeamId } from "./bracket-engine";
import { selectObaByeRecipient, type ObaByeCandidate } from "./oba-bye-award";
import {
  meetingKey,
  pairTeamsAvoidingRematches,
  pickSeatAvoidingRematch,
} from "./rematch-aware-pairing";
import type { StandingsGameInput } from "@/lib/services/standings/standings-engine";

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
  // Don't advance into losers rounds via winners path
  if (nextRound.roundType !== "WINNERS" && nextRound.roundType !== "FINAL") return;

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
 * Build OBA bye candidates + RP7.3 game inputs for an odd pairing cohort.
 * Bye history: structural R0 BYE advances + prior sit-out games (one team assigned, opponent null).
 */
async function loadObaByeCandidatesForTeams(
  bracketId: string,
  teamIds: string[],
  currentRoundIndex: number,
): Promise<{ candidates: ObaByeCandidate[]; gamesForRp73: StandingsGameInput[] }> {
  const idSet = new Set(teamIds);

  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    select: { tournamentId: true, divisionId: true },
  });
  if (!bracket) {
    return {
      candidates: teamIds.map((teamId) => ({
        teamId,
        bracketLosses: 0,
        byeCount: 0,
        hadByeInPreviousRound: false,
      })),
      gamesForRp73: [],
    };
  }

  const [matches, finalGames, sitOuts] = await Promise.all([
    prisma.bracketMatch.findMany({
      where: {
        bracketRound: { bracketId },
        OR: [{ homeIsBye: true }, { awayIsBye: true }],
      },
      include: {
        bracketRound: { select: { roundIndex: true } },
        game: { select: { homeTeamId: true, awayTeamId: true, status: true } },
      },
    }),
    prisma.game.findMany({
      where: {
        tournamentId: bracket.tournamentId,
        status: "FINAL",
        homeTeamId: { not: null },
        awayTeamId: { not: null },
        OR: [
          { bracketId },
          { pool: { divisionId: bracket.divisionId } },
        ],
      },
      select: {
        status: true,
        resultType: true,
        homeTeamId: true,
        awayTeamId: true,
        homeRuns: true,
        awayRuns: true,
        homeDefensiveInnings: true,
        awayDefensiveInnings: true,
        homeOffensiveInnings: true,
        awayOffensiveInnings: true,
        bracketId: true,
      },
    }),
    // Mid-round sit-outs only (exclude structural R0 BYE slots — counted via matches)
    prisma.game.findMany({
      where: {
        bracketId,
        AND: [
          {
            OR: [
              { homeTeamId: { not: null }, awayTeamId: null },
              { homeTeamId: null, awayTeamId: { not: null } },
            ],
          },
          {
            OR: [
              { bracketMatch: null },
              {
                bracketMatch: {
                  is: { homeIsBye: false, awayIsBye: false },
                },
              },
            ],
          },
        ],
      },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        bracketRound: { select: { roundIndex: true } },
      },
    }),
  ]);

  const byeCount = new Map<string, number>();
  const lastByeRound = new Map<string, number>();
  const bracketLosses = new Map<string, number>();
  for (const id of teamIds) {
    byeCount.set(id, 0);
    bracketLosses.set(id, 0);
  }

  for (const m of matches) {
    if (m.game?.status !== "FINAL") continue;
    const advanced = m.homeIsBye ? m.game.awayTeamId : m.game.homeTeamId;
    if (!advanced || !idSet.has(advanced)) continue;
    byeCount.set(advanced, (byeCount.get(advanced) ?? 0) + 1);
    const ri = m.bracketRound.roundIndex;
    const prev = lastByeRound.get(advanced);
    if (prev == null || ri > prev) lastByeRound.set(advanced, ri);
  }

  for (const g of sitOuts) {
    const tid = g.homeTeamId ?? g.awayTeamId;
    if (!tid || !idSet.has(tid)) continue;
    byeCount.set(tid, (byeCount.get(tid) ?? 0) + 1);
    const ri = g.bracketRound?.roundIndex ?? -1;
    const prev = lastByeRound.get(tid);
    if (prev == null || ri > prev) lastByeRound.set(tid, ri);
  }

  for (const g of finalGames) {
    if (g.bracketId !== bracketId) continue;
    // Count bracket losses only
    const home = g.homeTeamId!;
    const away = g.awayTeamId!;
    let loser: string | null = null;
    if (g.resultType === "FORFEIT_HOME_WINS") loser = away;
    else if (g.resultType === "FORFEIT_AWAY_WINS") loser = home;
    else if (g.homeRuns != null && g.awayRuns != null) {
      if (g.homeRuns > g.awayRuns) loser = away;
      else if (g.awayRuns > g.homeRuns) loser = home;
    }
    if (loser && idSet.has(loser)) {
      bracketLosses.set(loser, (bracketLosses.get(loser) ?? 0) + 1);
    }
  }

  const prevRound = currentRoundIndex - 1;
  const candidates: ObaByeCandidate[] = teamIds.map((teamId) => ({
    teamId,
    bracketLosses: bracketLosses.get(teamId) ?? 0,
    byeCount: byeCount.get(teamId) ?? 0,
    hadByeInPreviousRound: (lastByeRound.get(teamId) ?? -999) === prevRound,
  }));

  const gamesForRp73: StandingsGameInput[] = finalGames.map((g) => ({
    status: g.status,
    resultType: g.resultType,
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    homeRuns: g.homeRuns,
    awayRuns: g.awayRuns,
    homeDefensiveInnings: g.homeDefensiveInnings,
    awayDefensiveInnings: g.awayDefensiveInnings,
    homeOffensiveInnings: g.homeOffensiveInnings,
    awayOffensiveInnings: g.awayOffensiveInnings,
  }));

  return { candidates, gamesForRp73 };
}

async function placeIntoGrandFinalAway(bracketId: string, teamId: string): Promise<void> {
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
}

/**
 * Place a team into a losers / L2 round. When avoidRematchesUntilForced is on and the round
 * has not started, clear open seats and re-pair everyone currently in the round.
 */
async function placeTeamIntoSideRound(opts: {
  bracketId: string;
  roundId: string;
  teamId: string;
  avoidRematches: boolean;
}): Promise<void> {
  const round = await prisma.bracketRound.findUnique({
    where: { id: opts.roundId },
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

  const teamIdList = [...teamIds];
  let byeOpts: { selectByeRecipient: (ids: string[]) => string } | undefined;
  if (teamIdList.length % 2 === 1) {
    const { candidates, gamesForRp73 } = await loadObaByeCandidatesForTeams(
      opts.bracketId,
      teamIdList,
      round.roundIndex,
    );
    const byId = new Map(candidates.map((c) => [c.teamId, c]));
    byeOpts = {
      selectByeRecipient: (ids) =>
        selectObaByeRecipient(
          ids.map((id) => byId.get(id) ?? {
            teamId: id,
            bracketLosses: 0,
            byeCount: 0,
            hadByeInPreviousRound: false,
          }),
          gamesForRp73,
        ),
    };
  }

  const pairing = pairTeamsAvoidingRematches(teamIdList, prior, Math.random, byeOpts);
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

async function placeFixedIntoRound(
  bracketId: string,
  roundId: string,
  matchIndex: number,
  teamId: string,
): Promise<void> {
  const parentMatchIdx = Math.floor(matchIndex / 2);
  const homeSlot = matchIndex % 2 === 0;
  const childMatch = await prisma.bracketMatch.findUnique({
    where: {
      bracketRoundId_matchIndex: {
        bracketRoundId: roundId,
        matchIndex: parentMatchIdx,
      },
    },
    include: { game: true },
  });
  if (childMatch?.gameId && childMatch.game) {
    const g = childMatch.game;
    if (homeSlot && g.homeTeamId == null) {
      await prisma.game.update({ where: { id: childMatch.gameId }, data: { homeTeamId: teamId } });
      return;
    }
    if (!homeSlot && g.awayTeamId == null) {
      await prisma.game.update({ where: { id: childMatch.gameId }, data: { awayTeamId: teamId } });
      return;
    }
    if (g.homeTeamId == null) {
      await prisma.game.update({ where: { id: childMatch.gameId }, data: { homeTeamId: teamId } });
      return;
    }
    if (g.awayTeamId == null) {
      await prisma.game.update({ where: { id: childMatch.gameId }, data: { awayTeamId: teamId } });
      return;
    }
  }
  await placeTeamIntoSideRound({
    bracketId,
    roundId,
    teamId,
    avoidRematches: false,
  });
}

/** After a bracket game is FINAL, place winner (and maybe loser) into the next matchup. */
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
  const avoid = bracket?.avoidRematchesUntilForced === true;
  const format = bracket?.format;

  // --- L2 (2-loss): winner advances; loser is eliminated ---
  if (roundType === "LOSERS_SECOND") {
    const nextL2 = await prisma.bracketRound.findFirst({
      where: { bracketId, roundType: "LOSERS_SECOND", roundIndex: { gt: roundIndex } },
      orderBy: { roundIndex: "asc" },
    });
    if (!nextL2) {
      await placeIntoGrandFinalAway(bracketId, winner);
      return;
    }
    if (avoid) {
      await placeTeamIntoSideRound({
        bracketId,
        roundId: nextL2.id,
        teamId: winner,
        avoidRematches: true,
      });
    } else {
      await placeFixedIntoRound(bracketId, nextL2.id, m, winner);
    }
    return;
  }

  // --- L1 (1-loss) ---
  if (roundType === "LOSERS") {
    const nextL1 = await prisma.bracketRound.findFirst({
      where: { bracketId, roundType: "LOSERS", roundIndex: { gt: roundIndex } },
      orderBy: { roundIndex: "asc" },
    });

    if (format === "TRIPLE_ELIMINATION") {
      // Winner: next L1, or into L2 if this was L1 final
      if (nextL1) {
        if (avoid) {
          await placeTeamIntoSideRound({
            bracketId,
            roundId: nextL1.id,
            teamId: winner,
            avoidRematches: true,
          });
        } else {
          await placeFixedIntoRound(bracketId, nextL1.id, m, winner);
        }
      } else {
        await dropIntoFirstRoundOfType(bracketId, "LOSERS_SECOND", winner, avoid);
      }
      // Loser of L1 → L2
      const loser = bracketLoserTeamId(game);
      if (loser) {
        await dropIntoFirstRoundOfType(bracketId, "LOSERS_SECOND", loser, avoid);
      }
      return;
    }

    // Double-elim L1
    if (!nextL1) {
      await placeIntoGrandFinalAway(bracketId, winner);
      return;
    }
    if (avoid) {
      await placeTeamIntoSideRound({
        bracketId,
        roundId: nextL1.id,
        teamId: winner,
        avoidRematches: true,
      });
    } else {
      await placeFixedIntoRound(bracketId, nextL1.id, m, winner);
    }
    return;
  }

  // --- Winners / Final path ---
  await placeTeamInNextWinnersSlot(bracketId, roundIndex, m, winner);

  if (format === "DOUBLE_ELIMINATION" || format === "TRIPLE_ELIMINATION") {
    const loser = bracketLoserTeamId(game);
    if (loser) {
      await dropIntoFirstRoundOfType(bracketId, "LOSERS", loser, avoid, {
        winnersRoundIndex: roundIndex,
        winnersMatchIndex: m,
      });
    }
  }
}

async function dropIntoFirstRoundOfType(
  bracketId: string,
  roundType: "LOSERS" | "LOSERS_SECOND",
  teamId: string,
  avoidRematches: boolean,
  fixedHint?: { winnersRoundIndex: number; winnersMatchIndex: number },
): Promise<void> {
  const first = await prisma.bracketRound.findFirst({
    where: { bracketId, roundType },
    orderBy: { roundIndex: "asc" },
    include: { matches: { orderBy: { matchIndex: "asc" }, include: { game: true } } },
  });
  if (!first) return;

  if (avoidRematches) {
    await placeTeamIntoSideRound({
      bracketId,
      roundId: first.id,
      teamId,
      avoidRematches: true,
    });
    return;
  }

  // Classic: map winners R0 match i → losers slot i when dropping from winners
  if (fixedHint && roundType === "LOSERS" && first.matches.length > 0) {
    const targetIdx =
      fixedHint.winnersRoundIndex === 0
        ? Math.min(fixedHint.winnersMatchIndex, Math.max(0, first.matches.length - 1))
        : Math.min(
            Math.floor(fixedHint.winnersMatchIndex + fixedHint.winnersRoundIndex),
            Math.max(0, first.matches.length - 1),
          );
    const slot = first.matches[targetIdx];
    if (slot?.gameId && slot.game) {
      const data =
        slot.game.homeTeamId == null
          ? { homeTeamId: teamId }
          : slot.game.awayTeamId == null
            ? { awayTeamId: teamId }
            : null;
      if (data) {
        await prisma.game.update({ where: { id: slot.gameId }, data });
        return;
      }
    }
  }

  await placeTeamIntoSideRound({
    bracketId,
    roundId: first.id,
    teamId,
    avoidRematches: false,
  });
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
