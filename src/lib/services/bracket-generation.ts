import {
  BracketFormat,
  BracketRoundType,
  BracketSetupMode,
  GameStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  collectAdvancingSlotDescriptors,
  consolationRoundName,
  isValidEntryTeamCount,
  singleElimRoundName,
  type PoolAdvancerInput,
} from "./bracket-engine";

export type RegenerateBracketOptions = {
  tournamentId: string;
  bracketId: string;
  fieldId: string;
  startsAt: Date;
  /** Optional offset in hours between consecutive rounds (same start time within a round). */
  hoursBetweenRounds?: number;
};

async function loadPoolAdvancerInputs(tournamentId: string): Promise<PoolAdvancerInput[]> {
  const pools = await prisma.pool.findMany({
    where: { division: { tournamentId } },
    orderBy: [{ division: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: {
      division: { select: { sortOrder: true } },
      standings: { select: { teamId: true, displayOrder: true } },
    },
  });

  return pools.map((p) => ({
    poolId: p.id,
    poolSortKey: `${p.division.sortOrder}-${p.sortOrder}`,
    teamsAdvancing: p.teamsAdvancing,
    standingsRows: p.standings.map((s) => ({
      teamId: s.teamId,
      displayOrder: s.displayOrder,
    })),
  }));
}

/**
 * Rebuild single-elimination rounds, matches, and games for a bracket from current pool standings.
 * Deletes existing bracket games and rounds (and BracketMatch rows) under this bracket first.
 */
export async function regenerateSingleEliminationBracket(opts: RegenerateBracketOptions): Promise<{
  teamCount: number;
  rounds: number;
}> {
  const { tournamentId, bracketId, fieldId, startsAt, hoursBetweenRounds = 2 } = opts;

  const bracket = await prisma.bracket.findFirst({
    where: { id: bracketId, tournamentId },
  });
  if (!bracket) throw new Error("Bracket not found for this tournament");
  if (bracket.format !== BracketFormat.SINGLE_ELIMINATION) {
    throw new Error("Only single elimination is supported");
  }
  if (bracket.setupMode === BracketSetupMode.MANUAL) {
    throw new Error(
      "Cannot regenerate a manual bracket. Switch setup to Automated in bracket settings, or edit bracket games manually.",
    );
  }

  const field = await prisma.field.findFirst({
    where: { id: fieldId, tournamentId },
    select: { id: true },
  });
  if (!field) throw new Error("Field not found");

  const entryTeamCount = bracket.entryTeamCount;
  if (!isValidEntryTeamCount(entryTeamCount)) {
    throw new Error("Bracket entry team count must be a power of 2 between 2 and 64.");
  }

  const poolInputs = await loadPoolAdvancerInputs(tournamentId);
  const allSlots = collectAdvancingSlotDescriptors(poolInputs);

  if (allSlots.length < 2) {
    throw new Error(
      "Need at least 2 advancing teams across pools (set each pool's teams advancing and recompute standings).",
    );
  }
  if (allSlots.length < entryTeamCount) {
    throw new Error(
      `Need at least ${entryTeamCount} advancing teams (have ${allSlots.length}). Increase pool advancing counts or lower entry team count.`,
    );
  }

  const slots = allSlots.slice(0, entryTeamCount);
  const n = entryTeamCount;
  const totalWinnerRounds = Math.log2(n) | 0;
  const numSide = n / 2;
  const totalLRounds =
    bracket.consolationEnabled && n >= 4 ? (Math.log2(numSide) | 0) : 0;

  await prisma.$transaction(async (tx) => {
    await tx.game.deleteMany({ where: { bracketId } });
    await tx.bracketRound.deleteMany({ where: { bracketId } });

    const roundRows: { id: string; roundIndex: number; name: string; roundType: BracketRoundType }[] = [];

    for (let r = 0; r < totalWinnerRounds; r++) {
      const name = singleElimRoundName(r, totalWinnerRounds);
      const roundType = r === totalWinnerRounds - 1 ? BracketRoundType.FINAL : BracketRoundType.WINNERS;
      const created = await tx.bracketRound.create({
        data: { bracketId, name, roundIndex: r, roundType },
      });
      roundRows.push({
        id: created.id,
        roundIndex: r,
        name,
        roundType,
      });
    }

    for (let lr = 0; lr < totalLRounds; lr++) {
      const roundIndex = totalWinnerRounds + lr;
      const name = consolationRoundName(lr, totalLRounds);
      const roundType = lr === totalLRounds - 1 ? BracketRoundType.FINAL : BracketRoundType.LOSERS;
      const created = await tx.bracketRound.create({
        data: { bracketId, name, roundIndex, roundType },
      });
      roundRows.push({
        id: created.id,
        roundIndex,
        name,
        roundType,
      });
    }

    const baseMs = startsAt.getTime();
    const stepMs = hoursBetweenRounds * 60 * 60 * 1000;

    for (let r = 0; r < totalWinnerRounds; r++) {
      const matchesInRound = n / 2 ** (r + 1);
      const roundRecord = roundRows[r]!;
      const scheduledAt = new Date(baseMs + r * stepMs);

      for (let m = 0; m < matchesInRound; m++) {
        let homeId: string | null = null;
        let awayId: string | null = null;
        if (r === 0) {
          homeId = slots[2 * m]?.teamId ?? null;
          awayId = slots[2 * m + 1]?.teamId ?? null;
        }

        const homeSlot = r === 0 ? slots[2 * m] : undefined;
        const awaySlot = r === 0 ? slots[2 * m + 1] : undefined;

        const game = await tx.game.create({
          data: {
            tournamentId,
            poolId: null,
            fieldId,
            homeTeamId: homeId,
            awayTeamId: awayId,
            scheduledAt,
            status: GameStatus.SCHEDULED,
            resultType: "REGULAR",
            bracketId,
            bracketRoundId: roundRecord.id,
            bracketPosition: m,
          },
        });

        await tx.bracketMatch.create({
          data: {
            bracketRoundId: roundRecord.id,
            matchIndex: m,
            gameId: game.id,
            homeSourcePoolId: homeSlot?.poolId ?? null,
            homeSourceRank: homeSlot?.rank ?? null,
            awaySourcePoolId: awaySlot?.poolId ?? null,
            awaySourceRank: awaySlot?.rank ?? null,
          },
        });
      }
    }

    for (let lr = 0; lr < totalLRounds; lr++) {
      const matchesInRound = numSide / 2 ** (lr + 1);
      const roundRecord = roundRows[totalWinnerRounds + lr]!;
      const scheduledAt = new Date(baseMs + (totalWinnerRounds + lr) * stepMs);

      for (let m = 0; m < matchesInRound; m++) {
        const game = await tx.game.create({
          data: {
            tournamentId,
            poolId: null,
            fieldId,
            homeTeamId: null,
            awayTeamId: null,
            scheduledAt,
            status: GameStatus.SCHEDULED,
            resultType: "REGULAR",
            bracketId,
            bracketRoundId: roundRecord.id,
            bracketPosition: m,
          },
        });

        await tx.bracketMatch.create({
          data: {
            bracketRoundId: roundRecord.id,
            matchIndex: m,
            gameId: game.id,
            homeSourcePoolId: null,
            homeSourceRank: null,
            awaySourcePoolId: null,
            awaySourceRank: null,
          },
        });
      }
    }
  });

  return { teamCount: n, rounds: totalWinnerRounds + totalLRounds };
}

export type CreateBracketOptions = {
  tournamentId: string;
  name: string;
  fieldId: string;
  startsAt: Date;
  hoursBetweenRounds?: number;
  entryTeamCount?: number;
  consolationEnabled?: boolean;
};

export async function createSingleEliminationBracket(opts: CreateBracketOptions): Promise<string> {
  const maxOrder = await prisma.bracket.aggregate({
    where: { tournamentId: opts.tournamentId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const entryTeamCount = opts.entryTeamCount ?? 8;
  if (!isValidEntryTeamCount(entryTeamCount)) {
    throw new Error("Entry team count must be a power of 2 between 2 and 64.");
  }

  const bracket = await prisma.bracket.create({
    data: {
      tournamentId: opts.tournamentId,
      name: opts.name,
      sortOrder,
      format: BracketFormat.SINGLE_ELIMINATION,
      setupMode: BracketSetupMode.AUTOMATED,
      entryTeamCount,
      consolationEnabled: opts.consolationEnabled ?? false,
    },
  });

  await regenerateSingleEliminationBracket({
    tournamentId: opts.tournamentId,
    bracketId: bracket.id,
    fieldId: opts.fieldId,
    startsAt: opts.startsAt,
    hoursBetweenRounds: opts.hoursBetweenRounds,
  });

  return bracket.id;
}
