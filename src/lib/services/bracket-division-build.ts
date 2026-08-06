import {
  BracketFormat,
  BracketRoundType,
  BracketSlotFeedKind,
  GameStatus,
  GrandFinalMode,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  doubleElimLosersRoundSizes,
  isValidEntryTeamCount,
  losersRoundIndexForWinnersDrop,
  singleElimRoundName,
  tripleElimL2RoundSizes,
} from "./bracket-engine";
import { resolveBracketTeamsFromStandings } from "./bracket-resolution";
import { isDivisionRoundRobinCompleteForSeeding } from "./round-robin-division";
import { advanceByeWinnersInRound0 } from "./bracket-advance";

export type FirstRoundSide =
  | { poolId: string; rank: number }
  | { teamId: string }
  | { bye: true };

export type FirstRoundSlot = {
  home: FirstRoundSide;
  away: FirstRoundSide;
};

export type CreateDivisionPlayoffOptions = {
  tournamentId: string;
  divisionId: string;
  name: string;
  fieldId: string;
  startsAt: Date;
  hoursBetweenRounds?: number;
  /** Pairings for round 1 (field size = 2 × length). Sides may be byes. */
  firstRound: FirstRoundSlot[];
  /** When true, bracket is visible on the public site (still respects per-game schedule placeholders). */
  published?: boolean;
  format?: BracketFormat;
  /**
   * Double/triple: when true, losers (and L2) rounds re-pair to avoid rematches until forced.
   * When false, classic fixed feeder paths.
   */
  avoidRematchesUntilForced?: boolean;
  /** Double/triple grand final series mode. */
  grandFinalMode?: GrandFinalMode;
  /** Qualifier: conclude when this many teams remain alive. */
  isQualifier?: boolean;
  qualifyingTeamCount?: number;
};

function slotKey(poolId: string, rank: number) {
  return `${poolId}:${rank}`;
}

function isByeSide(side: FirstRoundSide): side is { bye: true } {
  return "bye" in side && side.bye === true;
}

function isTeamSide(side: FirstRoundSide): side is { teamId: string } {
  return "teamId" in side && typeof side.teamId === "string";
}

function isPoolSide(side: FirstRoundSide): side is { poolId: string; rank: number } {
  return "poolId" in side && typeof side.poolId === "string";
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function createSideBracketRounds(
  tx: Tx,
  opts: {
    tournamentId: string;
    bracketId: string;
    fieldId: string;
    startsAtMs: number;
    stepMs: number;
    startRoundIndex: number;
    scheduleRoundOffset: number;
    roundType: BracketRoundType;
    sizes: number[];
    nameFor: (i: number, total: number) => string;
  },
): Promise<number> {
  let roundIndex = opts.startRoundIndex;
  for (let i = 0; i < opts.sizes.length; i++) {
    const slots = opts.sizes[i]!;
    const round = await tx.bracketRound.create({
      data: {
        bracketId: opts.bracketId,
        name: opts.nameFor(i, opts.sizes.length),
        roundIndex,
        roundType: opts.roundType,
      },
    });
    const scheduledAt = new Date(
      opts.startsAtMs + (opts.scheduleRoundOffset + i) * opts.stepMs,
    );
    for (let m = 0; m < slots; m++) {
      const game = await tx.game.create({
        data: {
          tournamentId: opts.tournamentId,
          poolId: null,
          fieldId: opts.fieldId,
          homeTeamId: null,
          awayTeamId: null,
          scheduledAt,
          schedulePlaceholder: true,
          status: GameStatus.SCHEDULED,
          resultType: "REGULAR",
          bracketId: opts.bracketId,
          bracketRoundId: round.id,
          bracketPosition: m,
        },
      });
      await tx.bracketMatch.create({
        data: {
          bracketRoundId: round.id,
          matchIndex: m,
          gameId: game.id,
        },
      });
    }
    roundIndex += 1;
  }
  return roundIndex;
}

/** Wire classic winner feeders + losers-drop targets for multi-elim brackets. */
async function wireClassicDoubleElimFeeders(tx: Tx, bracketId: string): Promise<void> {
  const rounds = await tx.bracketRound.findMany({
    where: { bracketId },
    orderBy: { roundIndex: "asc" },
    include: { matches: { orderBy: { matchIndex: "asc" } } },
  });
  const winners = rounds.filter((r) => r.roundType === BracketRoundType.WINNERS);
  const losers = rounds.filter((r) => r.roundType === BracketRoundType.LOSERS);
  const finalRound = rounds.find((r) => r.roundType === BracketRoundType.FINAL);

  for (let r = 0; r < winners.length - 1; r++) {
    const cur = winners[r]!;
    const next = winners[r + 1]!;
    for (const match of cur.matches) {
      const parent = Math.floor(match.matchIndex / 2);
      const child = next.matches.find((m) => m.matchIndex === parent);
      if (!child) continue;
      const homeSlot = match.matchIndex % 2 === 0;
      await tx.bracketMatch.update({
        where: { id: child.id },
        data: homeSlot
          ? { homeFromMatchId: match.id, homeFromKind: BracketSlotFeedKind.WINNER }
          : { awayFromMatchId: match.id, awayFromKind: BracketSlotFeedKind.WINNER },
      });
    }
  }

  for (let wi = 0; wi < winners.length; wi++) {
    const lIdx = losersRoundIndexForWinnersDrop(wi, losers.length);
    const lRound = losers[lIdx];
    if (!lRound || lRound.matches.length === 0) continue;
    for (const match of winners[wi]!.matches) {
      const target =
        lRound.matches[Math.min(match.matchIndex, lRound.matches.length - 1)] ??
        lRound.matches[0]!;
      await tx.bracketMatch.update({
        where: { id: match.id },
        data: { loserDropMatchId: target.id },
      });
    }
  }

  // Consolidation: L even→odd winners advance within losers tree
  for (let li = 0; li < losers.length - 1; li++) {
    const cur = losers[li]!;
    const next = losers[li + 1]!;
    for (const match of cur.matches) {
      const parent = Math.min(
        Math.floor(match.matchIndex / 2),
        Math.max(0, next.matches.length - 1),
      );
      const child = next.matches.find((m) => m.matchIndex === parent) ?? next.matches[0];
      if (!child) continue;
      const homeSlot = match.matchIndex % 2 === 0;
      // Only set if empty so winners-side drops can own the other seat
      const existing = await tx.bracketMatch.findUnique({ where: { id: child.id } });
      if (homeSlot && !existing?.homeFromMatchId) {
        await tx.bracketMatch.update({
          where: { id: child.id },
          data: { homeFromMatchId: match.id, homeFromKind: BracketSlotFeedKind.WINNER },
        });
      } else if (!homeSlot && !existing?.awayFromMatchId) {
        await tx.bracketMatch.update({
          where: { id: child.id },
          data: { awayFromMatchId: match.id, awayFromKind: BracketSlotFeedKind.WINNER },
        });
      }
    }
  }

  const gf1 = finalRound?.matches.find((m) => m.matchIndex === 0);
  const winnersFinal = winners[winners.length - 1]?.matches[0];
  const losersFinal = losers[losers.length - 1]?.matches[0];
  if (gf1 && winnersFinal) {
    await tx.bracketMatch.update({
      where: { id: gf1.id },
      data: {
        homeFromMatchId: winnersFinal.id,
        homeFromKind: BracketSlotFeedKind.WINNER,
        awayFromMatchId: losersFinal?.id ?? null,
        awayFromKind: losersFinal ? BracketSlotFeedKind.WINNER : null,
      },
    });
  }
}

export async function createDivisionPlayoffBracket(opts: CreateDivisionPlayoffOptions): Promise<string> {
  const {
    tournamentId,
    divisionId,
    name,
    fieldId,
    startsAt,
    hoursBetweenRounds = 2,
    firstRound,
    published = false,
    format = BracketFormat.SINGLE_ELIMINATION,
    avoidRematchesUntilForced = false,
    grandFinalMode = GrandFinalMode.SINGLE,
    isQualifier = false,
    qualifyingTeamCount = 1,
  } = opts;

  const multiElim =
    format === BracketFormat.DOUBLE_ELIMINATION ||
    format === BracketFormat.TRIPLE_ELIMINATION;
  const qCount = Math.max(1, Math.min(64, qualifyingTeamCount));
  const gfMode = multiElim ? grandFinalMode : GrandFinalMode.SINGLE;

  const division = await prisma.division.findFirst({
    where: { id: divisionId, tournamentId },
    include: {
      pools: {
        include: {
          teams: { select: { id: true } },
        },
      },
    },
  });
  if (!division) throw new Error("Division not found for this tournament.");

  const existing = await prisma.bracket.findFirst({ where: { divisionId } });
  if (existing) throw new Error("This division already has a playoff bracket. Delete it before creating another.");

  const n = firstRound.length * 2;
  if (!isValidEntryTeamCount(n)) {
    throw new Error("Playoff bracket size must be a power of 2 between 2 and 64 (pad with byes if needed).");
  }

  const poolIds = new Set(division.pools.map((p) => p.id));
  const teamIdsInDivision = new Set(
    division.pools.flatMap((p) => p.teams.map((t) => t.id)),
  );
  const usedPoolSlots = new Set<string>();
  const usedTeamIds = new Set<string>();
  let usesDirectTeams = false;
  let usesPoolSlots = false;

  for (const slot of firstRound) {
    if (isByeSide(slot.home) && isByeSide(slot.away)) {
      throw new Error("A first-round game cannot be BYE vs BYE.");
    }
    for (const side of [slot.home, slot.away] as const) {
      if (isByeSide(side)) continue;
      if (isTeamSide(side)) {
        usesDirectTeams = true;
        if (!teamIdsInDivision.has(side.teamId)) {
          throw new Error("Each team must belong to the selected division.");
        }
        if (usedTeamIds.has(side.teamId)) {
          throw new Error("Duplicate team in the first round.");
        }
        usedTeamIds.add(side.teamId);
        continue;
      }
      if (isPoolSide(side)) {
        usesPoolSlots = true;
        if (!poolIds.has(side.poolId)) throw new Error("Each pool must belong to the selected division.");
        const pool = division.pools.find((p) => p.id === side.poolId)!;
        const maxRank = pool.teams.length;
        if (side.rank < 1 || side.rank > maxRank) {
          throw new Error(`Invalid rank ${side.rank} for pool (has ${maxRank} teams).`);
        }
        const key = slotKey(side.poolId, side.rank);
        if (usedPoolSlots.has(key)) throw new Error("Duplicate pool/rank slot in the first round.");
        usedPoolSlots.add(key);
      }
    }
  }
  if (usesDirectTeams && usesPoolSlots) {
    throw new Error("Use either pool standings slots or direct team picks for the whole first round, not both.");
  }
  if (usesPoolSlots && division.pools.length === 0) {
    throw new Error("This division has no pools — assign teams directly, or add pools first.");
  }
  if (usesDirectTeams && teamIdsInDivision.size === 0) {
    throw new Error("This division has no teams to assign.");
  }

  const field = await prisma.field.findFirst({
    where: { id: fieldId, tournamentId },
    select: { id: true },
  });
  if (!field) throw new Error("Field not found.");

  const maxOrder = await prisma.bracket.aggregate({
    where: { tournamentId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const bracketId = await prisma.$transaction(async (tx) => {
    const bracket = await tx.bracket.create({
      data: {
        tournamentId,
        divisionId,
        name,
        sortOrder,
        format,
        avoidRematchesUntilForced: multiElim ? avoidRematchesUntilForced : false,
        grandFinalMode: gfMode,
        isQualifier: isQualifier === true,
        qualifyingTeamCount: isQualifier ? qCount : 1,
        published,
        needsResolutionRefresh: false,
      },
    });

    const totalWinnerRounds = (Math.log2(n) | 0) as number;
    const roundRows: { id: string; roundIndex: number; name: string }[] = [];
    const baseMs = startsAt.getTime();
    const stepMs = hoursBetweenRounds * 60 * 60 * 1000;

    for (let r = 0; r < totalWinnerRounds; r++) {
      const isLast = r === totalWinnerRounds - 1;
      let nameRound = singleElimRoundName(r, totalWinnerRounds);
      let roundType: BracketRoundType = BracketRoundType.WINNERS;
      if (!multiElim && isLast) {
        roundType = BracketRoundType.FINAL;
      } else if (multiElim && isLast) {
        nameRound = "Winners final";
      }
      const created = await tx.bracketRound.create({
        data: { bracketId: bracket.id, name: nameRound, roundIndex: r, roundType },
      });
      roundRows.push({
        id: created.id,
        roundIndex: r,
        name: nameRound,
      });
    }

    let nextRoundIndex = totalWinnerRounds;
    let scheduleOffset = totalWinnerRounds;

    // Double/triple: losers trees, then a dedicated grand-final round.
    if (multiElim) {
      const l1Sizes = doubleElimLosersRoundSizes(n);
      nextRoundIndex = await createSideBracketRounds(tx, {
        tournamentId,
        bracketId: bracket.id,
        fieldId,
        startsAtMs: baseMs,
        stepMs,
        startRoundIndex: nextRoundIndex,
        scheduleRoundOffset: scheduleOffset,
        roundType: BracketRoundType.LOSERS,
        sizes: l1Sizes,
        nameFor: (i, total) =>
          i === total - 1 ? "Losers final (1 loss)" : `Losers round ${i + 1}`,
      });
      scheduleOffset += l1Sizes.length;

      if (format === BracketFormat.TRIPLE_ELIMINATION) {
        const l2Sizes = tripleElimL2RoundSizes(n);
        nextRoundIndex = await createSideBracketRounds(tx, {
          tournamentId,
          bracketId: bracket.id,
          fieldId,
          startsAtMs: baseMs,
          stepMs,
          startRoundIndex: nextRoundIndex,
          scheduleRoundOffset: scheduleOffset,
          roundType: BracketRoundType.LOSERS_SECOND,
          sizes: l2Sizes,
          nameFor: (i, total) =>
            i === total - 1 ? "Losers final (2 losses)" : `L2 round ${i + 1}`,
        });
        scheduleOffset += l2Sizes.length;
      }

      const gfGames = gfMode === GrandFinalMode.IF_NECESSARY ? 2 : 1;
      const gfRound = await tx.bracketRound.create({
        data: {
          bracketId: bracket.id,
          name: gfGames > 1 ? "Grand final" : "Grand final",
          roundIndex: nextRoundIndex,
          roundType: BracketRoundType.FINAL,
        },
      });
      const gfAt = new Date(baseMs + scheduleOffset * stepMs);
      for (let m = 0; m < gfGames; m++) {
        const game = await tx.game.create({
          data: {
            tournamentId,
            poolId: null,
            fieldId,
            homeTeamId: null,
            awayTeamId: null,
            scheduledAt: gfAt,
            schedulePlaceholder: true,
            status: GameStatus.SCHEDULED,
            resultType: "REGULAR",
            bracketId: bracket.id,
            bracketRoundId: gfRound.id,
            bracketPosition: m,
            gameNumber: m === 0 ? "GF1" : "GF2 (if necessary)",
          },
        });
        await tx.bracketMatch.create({
          data: {
            bracketRoundId: gfRound.id,
            matchIndex: m,
            gameId: game.id,
          },
        });
      }
    }

    for (let r = 0; r < totalWinnerRounds; r++) {
      const matchesInRound = n / 2 ** (r + 1);
      const roundRecord = roundRows[r]!;
      const scheduledAt = new Date(baseMs + r * stepMs);

      for (let m = 0; m < matchesInRound; m++) {
        let homeSourcePoolId: string | null = null;
        let homeSourceRank: number | null = null;
        let awaySourcePoolId: string | null = null;
        let awaySourceRank: number | null = null;
        let homeIsBye = false;
        let awayIsBye = false;
        let homeTeamId: string | null = null;
        let awayTeamId: string | null = null;

        if (r === 0) {
          const fr = firstRound[m]!;
          if (isByeSide(fr.home)) {
            homeIsBye = true;
          } else if (isPoolSide(fr.home)) {
            homeSourcePoolId = fr.home.poolId;
            homeSourceRank = fr.home.rank;
          } else if (isTeamSide(fr.home)) {
            homeTeamId = fr.home.teamId;
          }
          if (isByeSide(fr.away)) {
            awayIsBye = true;
          } else if (isPoolSide(fr.away)) {
            awaySourcePoolId = fr.away.poolId;
            awaySourceRank = fr.away.rank;
          } else if (isTeamSide(fr.away)) {
            awayTeamId = fr.away.teamId;
          }
        }

        const game = await tx.game.create({
          data: {
            tournamentId,
            poolId: null,
            fieldId,
            homeTeamId,
            awayTeamId,
            scheduledAt,
            schedulePlaceholder: true,
            status: GameStatus.SCHEDULED,
            resultType: "REGULAR",
            bracketId: bracket.id,
            bracketRoundId: roundRecord.id,
            bracketPosition: m,
          },
        });

        await tx.bracketMatch.create({
          data: {
            bracketRoundId: roundRecord.id,
            matchIndex: m,
            gameId: game.id,
            homeSourcePoolId,
            homeSourceRank,
            awaySourcePoolId,
            awaySourceRank,
            homeIsBye,
            awayIsBye,
          },
        });
      }
    }

    if (multiElim) {
      await wireClassicDoubleElimFeeders(tx, bracket.id);
    }

    return bracket.id;
  });

  if (usesDirectTeams) {
    await advanceByeWinnersInRound0(bracketId);
  } else {
    const rrDone = await isDivisionRoundRobinCompleteForSeeding(tournamentId, divisionId);
    if (rrDone) {
      await resolveBracketTeamsFromStandings(bracketId);
      await advanceByeWinnersInRound0(bracketId);
    } else {
      await prisma.bracket.update({
        where: { id: bracketId },
        data: { needsResolutionRefresh: true },
      });
    }
  }
  return bracketId;
}
