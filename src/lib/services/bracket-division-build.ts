import { BracketFormat, BracketRoundType, GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  doubleElimLosersRoundSizes,
  isValidEntryTeamCount,
  singleElimRoundName,
  tripleElimL2RoundSizes,
} from "./bracket-engine";
import { resolveBracketTeamsFromStandings } from "./bracket-resolution";
import { isDivisionRoundRobinCompleteForSeeding } from "./round-robin-division";
import { advanceByeWinnersInRound0 } from "./bracket-advance";

export type FirstRoundSide = { poolId: string; rank: number } | { bye: true };

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
};

function slotKey(poolId: string, rank: number) {
  return `${poolId}:${rank}`;
}

function isByeSide(side: FirstRoundSide): side is { bye: true } {
  return "bye" in side && side.bye === true;
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
  } = opts;

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
  const used = new Set<string>();

  for (const slot of firstRound) {
    if (isByeSide(slot.home) && isByeSide(slot.away)) {
      throw new Error("A first-round game cannot be BYE vs BYE.");
    }
    for (const side of [slot.home, slot.away] as const) {
      if (isByeSide(side)) continue;
      if (!poolIds.has(side.poolId)) throw new Error("Each pool must belong to the selected division.");
      const pool = division.pools.find((p) => p.id === side.poolId)!;
      const maxRank = pool.teams.length;
      if (side.rank < 1 || side.rank > maxRank) {
        throw new Error(`Invalid rank ${side.rank} for pool (has ${maxRank} teams).`);
      }
      const key = slotKey(side.poolId, side.rank);
      if (used.has(key)) throw new Error("Duplicate pool/rank slot in the first round.");
      used.add(key);
    }
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
        avoidRematchesUntilForced:
          format === BracketFormat.DOUBLE_ELIMINATION ||
          format === BracketFormat.TRIPLE_ELIMINATION
            ? avoidRematchesUntilForced
            : false,
        published,
        needsResolutionRefresh: false,
      },
    });

    const totalWinnerRounds = (Math.log2(n) | 0) as number;
    const roundRows: { id: string; roundIndex: number; name: string }[] = [];

    for (let r = 0; r < totalWinnerRounds; r++) {
      const nameRound = singleElimRoundName(r, totalWinnerRounds);
      const roundType = r === totalWinnerRounds - 1 ? BracketRoundType.FINAL : BracketRoundType.WINNERS;
      const created = await tx.bracketRound.create({
        data: { bracketId: bracket.id, name: nameRound, roundIndex: r, roundType },
      });
      roundRows.push({
        id: created.id,
        roundIndex: r,
        name: nameRound,
      });
    }

    // Double/triple: full losers trees (all rounds get games). Triple also adds L2 (LOSERS_SECOND).
    if (
      format === BracketFormat.DOUBLE_ELIMINATION ||
      format === BracketFormat.TRIPLE_ELIMINATION
    ) {
      const baseMs = startsAt.getTime();
      const stepMs = hoursBetweenRounds * 60 * 60 * 1000;
      const l1Sizes = doubleElimLosersRoundSizes(n);
      let nextRoundIndex = await createSideBracketRounds(tx, {
        tournamentId,
        bracketId: bracket.id,
        fieldId,
        startsAtMs: baseMs,
        stepMs,
        startRoundIndex: totalWinnerRounds,
        scheduleRoundOffset: totalWinnerRounds,
        roundType: BracketRoundType.LOSERS,
        sizes: l1Sizes,
        nameFor: (i, total) =>
          i === total - 1 ? "Losers final (1 loss)" : `Losers round ${i + 1}`,
      });

      if (format === BracketFormat.TRIPLE_ELIMINATION) {
        const l2Sizes = tripleElimL2RoundSizes(n);
        await createSideBracketRounds(tx, {
          tournamentId,
          bracketId: bracket.id,
          fieldId,
          startsAtMs: baseMs,
          stepMs,
          startRoundIndex: nextRoundIndex,
          scheduleRoundOffset: totalWinnerRounds + l1Sizes.length,
          roundType: BracketRoundType.LOSERS_SECOND,
          sizes: l2Sizes,
          nameFor: (i, total) =>
            i === total - 1 ? "Losers final (2 losses)" : `L2 round ${i + 1}`,
        });
      }
    }

    const baseMs = startsAt.getTime();
    const stepMs = hoursBetweenRounds * 60 * 60 * 1000;

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

        if (r === 0) {
          const fr = firstRound[m]!;
          if (isByeSide(fr.home)) {
            homeIsBye = true;
          } else {
            homeSourcePoolId = fr.home.poolId;
            homeSourceRank = fr.home.rank;
          }
          if (isByeSide(fr.away)) {
            awayIsBye = true;
          } else {
            awaySourcePoolId = fr.away.poolId;
            awaySourceRank = fr.away.rank;
          }
        }

        const game = await tx.game.create({
          data: {
            tournamentId,
            poolId: null,
            fieldId,
            homeTeamId: null,
            awayTeamId: null,
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

    return bracket.id;
  });

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
  return bracketId;
}
