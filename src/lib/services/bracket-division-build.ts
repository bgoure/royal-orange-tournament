import { BracketFormat, BracketRoundType, GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isValidEntryTeamCount, singleElimRoundName } from "./bracket-engine";
import { resolveBracketTeamsFromStandings } from "./bracket-resolution";
import { isDivisionRoundRobinCompleteForSeeding } from "./round-robin-division";

export type FirstRoundSlot = {
  home: { poolId: string; rank: number };
  away: { poolId: string; rank: number };
};

export type CreateDivisionPlayoffOptions = {
  tournamentId: string;
  divisionId: string;
  name: string;
  fieldId: string;
  startsAt: Date;
  hoursBetweenRounds?: number;
  /** Pairings for round 1 (field size = 2 × length). */
  firstRound: FirstRoundSlot[];
  /** When true, bracket is visible on the public site (still respects per-game schedule placeholders). */
  published?: boolean;
};

function slotKey(poolId: string, rank: number) {
  return `${poolId}:${rank}`;
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
    throw new Error("Playoff field size must be a power of 2 between 2 and 64.");
  }

  const poolIds = new Set(division.pools.map((p) => p.id));
  const used = new Set<string>();

  for (const slot of firstRound) {
    for (const side of [slot.home, slot.away] as const) {
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
        format: BracketFormat.SINGLE_ELIMINATION,
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

        if (r === 0) {
          const fr = firstRound[m]!;
          homeSourcePoolId = fr.home.poolId;
          homeSourceRank = fr.home.rank;
          awaySourcePoolId = fr.away.poolId;
          awaySourceRank = fr.away.rank;
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
          },
        });
      }
    }

    return bracket.id;
  });

  const rrDone = await isDivisionRoundRobinCompleteForSeeding(tournamentId, divisionId);
  if (rrDone) {
    await resolveBracketTeamsFromStandings(bracketId);
  } else {
    await prisma.bracket.update({
      where: { id: bracketId },
      data: { needsResolutionRefresh: true },
    });
  }
  return bracketId;
}
