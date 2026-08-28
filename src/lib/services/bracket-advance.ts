import { prisma } from "@/lib/db";
import {
  aliveTeamIds,
  bracketLoserTeamId,
  bracketWinnerTeamId,
  losersRoundIndexForWinnersDrop,
} from "./bracket-engine";
import { selectObaByeRecipient, type ObaByeCandidate } from "./oba-bye-award";
import {
  meetingKey,
  pairTeamsAvoidingRematches,
  pickSeatAvoidingRematch,
} from "./rematch-aware-pairing";
import type { StandingsGameInput } from "@/lib/services/standings/standings-engine";
import { maybeResolveObaPresetPairings } from "@/lib/services/oba-de-redraw";
import { isObaFeederMapPreset } from "@/lib/brackets/oba-de-presets";

async function placeIntoGrandFinalHome(bracketId: string, teamId: string): Promise<void> {
  const grandFinal = await prisma.bracketRound.findFirst({
    where: { bracketId, roundType: "FINAL" },
    include: { matches: { orderBy: { matchIndex: "asc" }, take: 1 } },
  });
  const gfGameId = grandFinal?.matches[0]?.gameId;
  if (gfGameId) {
    await prisma.game.update({
      where: { id: gfGameId },
      data: { homeTeamId: teamId },
    });
  }
}

async function placeTeamInNextWinnersSlot(
  bracketId: string,
  roundIndex: number,
  matchIndex: number,
  teamId: string,
): Promise<void> {
  const nextRound = await prisma.bracketRound.findFirst({
    where: { bracketId, roundIndex: roundIndex + 1 },
  });
  // Multi-elim: after winners final, next roundIndex is losers — jump to grand final home.
  if (!nextRound?.id || (nextRound.roundType !== "WINNERS" && nextRound.roundType !== "FINAL")) {
    await placeIntoGrandFinalHome(bracketId, teamId);
    return;
  }

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

/** Place winner/loser into any match that lists this match as an explicit feeder. */
async function placeViaExplicitFeeders(
  sourceMatchId: string,
  kind: "WINNER" | "LOSER",
  teamId: string,
): Promise<boolean> {
  const targets = await prisma.bracketMatch.findMany({
    where: {
      OR: [
        { homeFromMatchId: sourceMatchId, homeFromKind: kind },
        { awayFromMatchId: sourceMatchId, awayFromKind: kind },
      ],
    },
    include: { game: true },
  });
  let placed = false;
  for (const t of targets) {
    if (!t.gameId || !t.game) continue;
    if (t.game.status === "LIVE" || t.game.status === "FINAL" || t.game.status === "CANCELLED") continue;
    if (t.homeFromMatchId === sourceMatchId && t.homeFromKind === kind && t.game.homeTeamId == null) {
      await prisma.game.update({ where: { id: t.gameId }, data: { homeTeamId: teamId } });
      placed = true;
    }
    if (t.awayFromMatchId === sourceMatchId && t.awayFromKind === kind && t.game.awayTeamId == null) {
      await prisma.game.update({ where: { id: t.gameId }, data: { awayTeamId: teamId } });
      placed = true;
    }
  }
  return placed;
}

async function placeIntoMatchSeat(matchId: string, teamId: string): Promise<boolean> {
  const match = await prisma.bracketMatch.findUnique({
    where: { id: matchId },
    include: { game: true },
  });
  if (!match?.gameId || !match.game) return false;
  if (match.game.status === "LIVE" || match.game.status === "FINAL" || match.game.status === "CANCELLED") return false;
  if (match.game.homeTeamId === teamId || match.game.awayTeamId === teamId) return true;
  if (match.game.homeTeamId == null) {
    await prisma.game.update({ where: { id: match.gameId }, data: { homeTeamId: teamId } });
    return true;
  }
  if (match.game.awayTeamId == null) {
    await prisma.game.update({ where: { id: match.gameId }, data: { awayTeamId: teamId } });
    return true;
  }
  return false;
}

async function qualifierFieldReducedToN(
  bracketId: string,
  format: string,
  need: number,
): Promise<boolean> {
  const games = await prisma.game.findMany({
    where: { bracketId },
    select: {
      status: true,
      resultType: true,
      homeTeamId: true,
      awayTeamId: true,
      homeRuns: true,
      awayRuns: true,
    },
  });
  // Include bye seeds that never appear in Round 1 (OBA 5–7 seeded maps).
  const entrants = new Set<string>();
  for (const g of games) {
    if (g.homeTeamId) entrants.add(g.homeTeamId);
    if (g.awayTeamId) entrants.add(g.awayTeamId);
  }
  const entrantIds = [...entrants];
  const alive = aliveTeamIds({
    format,
    entrantTeamIds: entrantIds,
    games,
  });
  // Require eliminations so seeding / reset (everyone still alive) never marks concluded.
  return (
    entrantIds.length > need &&
    alive.length > 0 &&
    alive.length <= need &&
    alive.length < entrantIds.length
  );
}

async function maybeConcludeQualifier(bracketId: string): Promise<void> {
  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    select: {
      format: true,
      isQualifier: true,
      qualifyingTeamCount: true,
      concludedAt: true,
    },
  });
  if (!bracket || bracket.concludedAt) return;
  if (!bracket.isQualifier && bracket.qualifyingTeamCount <= 1) return;

  const need = Math.max(1, bracket.qualifyingTeamCount);
  if (await qualifierFieldReducedToN(bracketId, bracket.format, need)) {
    await prisma.bracket.update({
      where: { id: bracketId },
      data: { concludedAt: new Date() },
    });
  }
}

/** Recompute `concludedAt` after directors change qualifier N mid-event. */
export async function resyncQualifierConclusion(bracketId: string): Promise<void> {
  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    select: {
      format: true,
      isQualifier: true,
      qualifyingTeamCount: true,
      concludedAt: true,
    },
  });
  if (!bracket) return;

  if (!bracket.isQualifier && bracket.qualifyingTeamCount <= 1) {
    if (bracket.concludedAt) {
      await prisma.bracket.update({
        where: { id: bracketId },
        data: { concludedAt: null },
      });
    }
    return;
  }

  const need = Math.max(1, bracket.qualifyingTeamCount);
  const reduced = await qualifierFieldReducedToN(bracketId, bracket.format, need);
  if (reduced && !bracket.concludedAt) {
    await prisma.bracket.update({
      where: { id: bracketId },
      data: { concludedAt: new Date() },
    });
  } else if (!reduced && bracket.concludedAt) {
    await prisma.bracket.update({
      where: { id: bracketId },
      data: { concludedAt: null },
    });
  }
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
 * Build RP5.2 bye candidates + RP7.3 game inputs for an odd pairing cohort.
 * Bye history: structural R0 BYE advances + prior sit-out games (one team assigned, opponent null).
 */
export async function loadObaByeCandidatesForTeams(
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
    select: {
      format: true,
      avoidRematchesUntilForced: true,
      grandFinalMode: true,
      isQualifier: true,
      qualifyingTeamCount: true,
      concludedAt: true,
      presetKey: true,
    },
  });
  const avoid = bracket?.avoidRematchesUntilForced === true;
  const format = bracket?.format;
  const isObaCustomMap = isObaFeederMapPreset(bracket?.presetKey);

  // Explicit feeder overrides (Phase D / OBA maps)
  const fedWinner = await placeViaExplicitFeeders(match.id, "WINNER", winner);
  const loser = bracketLoserTeamId(game);
  if (loser) {
    if (match.loserDropMatchId) {
      await placeIntoMatchSeat(match.loserDropMatchId, loser);
    } else {
      await placeViaExplicitFeeders(match.id, "LOSER", loser);
    }
  }

  // --- Grand final series ---
  if (roundType === "FINAL") {
    if (bracket?.grandFinalMode === "IF_NECESSARY" && m === 0) {
      const gfRound = match.bracketRound;
      const gf2 = await prisma.bracketMatch.findUnique({
        where: {
          bracketRoundId_matchIndex: { bracketRoundId: gfRound.id, matchIndex: 1 },
        },
        include: { game: true },
      });
      // Away (losers champ) beat home (undefeated) → require GF2
      if (winner === game.awayTeamId && gf2?.gameId) {
        await prisma.game.update({
          where: { id: gf2.gameId },
          data: {
            homeTeamId: game.homeTeamId,
            awayTeamId: game.awayTeamId,
            status: "SCHEDULED",
            // Keep TBD — seed time is not a real field booking.
          },
        });
      }
    }
    await maybeConcludeQualifier(bracketId);
    return;
  }

  // OBA 5–7 custom maps: feeders + redraw resolver only (no classic W/L fallthrough).
  if (isObaCustomMap) {
    await maybeResolveObaPresetPairings(bracketId);
    await maybeConcludeQualifier(bracketId);
    return;
  }

  // --- L2 (2-loss): winner advances; loser is eliminated ---
  if (roundType === "LOSERS_SECOND") {
    if (!fedWinner) {
      const nextL2 = await prisma.bracketRound.findFirst({
        where: { bracketId, roundType: "LOSERS_SECOND", roundIndex: { gt: roundIndex } },
        orderBy: { roundIndex: "asc" },
      });
      if (!nextL2) {
        await placeIntoGrandFinalAway(bracketId, winner);
      } else if (avoid) {
        await placeTeamIntoSideRound({
          bracketId,
          roundId: nextL2.id,
          teamId: winner,
          avoidRematches: true,
        });
      } else {
        await placeFixedIntoRound(bracketId, nextL2.id, m, winner);
      }
    }
    await maybeConcludeQualifier(bracketId);
    return;
  }

  // --- L1 (1-loss) ---
  if (roundType === "LOSERS") {
    if (!fedWinner) {
      const nextL1 = await prisma.bracketRound.findFirst({
        where: { bracketId, roundType: "LOSERS", roundIndex: { gt: roundIndex } },
        orderBy: { roundIndex: "asc" },
      });

      if (format === "TRIPLE_ELIMINATION") {
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
          await dropLoserIntoSideBracket(bracketId, "LOSERS_SECOND", winner, avoid);
        }
        if (loser && !match.loserDropMatchId) {
          await dropLoserIntoSideBracket(bracketId, "LOSERS_SECOND", loser, avoid);
        }
        await maybeConcludeQualifier(bracketId);
        return;
      }

      // Double-elim L1
      if (!nextL1) {
        await placeIntoGrandFinalAway(bracketId, winner);
      } else if (avoid) {
        await placeTeamIntoSideRound({
          bracketId,
          roundId: nextL1.id,
          teamId: winner,
          avoidRematches: true,
        });
      } else {
        await placeFixedIntoRound(bracketId, nextL1.id, m, winner);
      }
    }
    await maybeConcludeQualifier(bracketId);
    return;
  }

  // --- Winners path ---
  if (!fedWinner) {
    await placeTeamInNextWinnersSlot(bracketId, roundIndex, m, winner);
  }

  if (
    (format === "DOUBLE_ELIMINATION" || format === "TRIPLE_ELIMINATION") &&
    loser &&
    !match.loserDropMatchId
  ) {
    // Winners-round depth among WINNERS rounds only (0-based).
    const winnersRounds = await prisma.bracketRound.findMany({
      where: { bracketId, roundType: "WINNERS" },
      orderBy: { roundIndex: "asc" },
      select: { roundIndex: true },
    });
    const winnersDepth = Math.max(
      0,
      winnersRounds.findIndex((r) => r.roundIndex === roundIndex),
    );
    await dropLoserIntoSideBracket(bracketId, "LOSERS", loser, avoid, {
      winnersRoundIndex: winnersDepth,
      winnersMatchIndex: m,
    });
  }

  await maybeConcludeQualifier(bracketId);
}

/**
 * Drop a team into the correct losers / L2 round (not always the first).
 * Prefer `loserDropMatchId` on the source match when set (wired at build / Phase D edits).
 */
async function dropLoserIntoSideBracket(
  bracketId: string,
  roundType: "LOSERS" | "LOSERS_SECOND",
  teamId: string,
  avoidRematches: boolean,
  fixedHint?: { winnersRoundIndex: number; winnersMatchIndex: number },
): Promise<void> {
  const sideRounds = await prisma.bracketRound.findMany({
    where: { bracketId, roundType },
    orderBy: { roundIndex: "asc" },
    include: { matches: { orderBy: { matchIndex: "asc" }, include: { game: true } } },
  });
  if (sideRounds.length === 0) return;

  let targetRound = sideRounds[0]!;
  if (fixedHint && roundType === "LOSERS") {
    const idx = losersRoundIndexForWinnersDrop(fixedHint.winnersRoundIndex, sideRounds.length);
    targetRound = sideRounds[idx] ?? targetRound;
  }

  if (avoidRematches) {
    await placeTeamIntoSideRound({
      bracketId,
      roundId: targetRound.id,
      teamId,
      avoidRematches: true,
    });
    return;
  }

  if (fixedHint && targetRound.matches.length > 0) {
    const targetIdx = Math.min(
      fixedHint.winnersMatchIndex,
      Math.max(0, targetRound.matches.length - 1),
    );
    const slot = targetRound.matches[targetIdx];
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
    roundId: targetRound.id,
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
        // Bye has no field slot — leave TBD so seed times do not block the diamond.
        schedulePlaceholder: true,
      },
    });
  }
}

/** @deprecated Consolation mini-bracket removed; kept as no-op for callers. */
export async function advanceBracketLoserFromWinnersRound0(): Promise<void> {}
