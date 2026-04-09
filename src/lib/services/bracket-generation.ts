import { BracketFormat, BracketRoundType, GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  collectAdvancingSlotDescriptors,
  isPowerOfTwo,
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

  const field = await prisma.field.findFirst({
    where: { id: fieldId, tournamentId },
    select: { id: true },
  });
  if (!field) throw new Error("Field not found");

  const poolInputs = await loadPoolAdvancerInputs(tournamentId);
  const slots = collectAdvancingSlotDescriptors(poolInputs);
  const advancers = slots.map((s) => s.teamId);

  if (advancers.length < 2) {
    throw new Error(
      "Need at least 2 advancing teams across pools (set each pool's teams advancing and recompute standings).",
    );
  }
  if (!isPowerOfTwo(advancers.length)) {
    throw new Error(
      `Total advancing teams must be a power of 2 (got ${advancers.length}). Adjust teams advancing per pool.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.game.deleteMany({ where: { bracketId } });
    await tx.bracketRound.deleteMany({ where: { bracketId } });

    const n = advancers.length;
    const totalRounds = Math.log2(n);

    const roundRows: { id: string; roundIndex: number; name: string; roundType: BracketRoundType }[] = [];
    for (let r = 0; r < totalRounds; r++) {
      const name = singleElimRoundName(r, totalRounds);
      const roundType = r === totalRounds - 1 ? BracketRoundType.FINAL : BracketRoundType.WINNERS;
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

    const baseMs = startsAt.getTime();
    const stepMs = hoursBetweenRounds * 60 * 60 * 1000;

    for (let r = 0; r < totalRounds; r++) {
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
  });

  return { teamCount: advancers.length, rounds: Math.log2(advancers.length) };
}

export type CreateBracketOptions = {
  tournamentId: string;
  name: string;
  fieldId: string;
  startsAt: Date;
  hoursBetweenRounds?: number;
};

export async function createSingleEliminationBracket(opts: CreateBracketOptions): Promise<string> {
  const maxOrder = await prisma.bracket.aggregate({
    where: { tournamentId: opts.tournamentId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const bracket = await prisma.bracket.create({
    data: {
      tournamentId: opts.tournamentId,
      name: opts.name,
      sortOrder,
      format: BracketFormat.SINGLE_ELIMINATION,
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
