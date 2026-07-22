import { GameKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDatetimeLocalInTimeZone } from "@/lib/datetime-tournament";
import { isValidAdvancingTeamCount, padSlotsWithByes } from "@/lib/services/bracket-engine";
import {
  createDivisionPlayoffBracket,
  type FirstRoundSlot,
} from "@/lib/services/bracket-division-build";
import {
  buildRoundRobinPairings,
  emptySchedulePackingCursor,
  estimateScheduleCapacity,
  scheduleRoundRobinSlotsInWindow,
  type SchedulePackingCursor,
  type ScheduleWindowOpts,
} from "@/lib/services/round-robin-schedule";
import { recomputePoolStandings } from "@/lib/services/standings";

export type WizardFinishResult = {
  schedulesGenerated: boolean;
  gamesCreated: number;
  bracketsCreated: number;
  notes: string[];
};

function defaultFirstRound(
  pools: { id: string; teamCount: number }[],
  entrySize: number,
): FirstRoundSlot[] {
  const pairs = entrySize / 2;
  const out: FirstRoundSlot[] = [];
  if (pools.length === 0) return out;
  if (pools.length >= 2) {
    const a = pools[0]!;
    const b = pools[1]!;
    for (let m = 0; m < pairs; m++) {
      const rank = m + 1;
      out.push({
        home: { poolId: a.id, rank: Math.min(rank, Math.max(1, a.teamCount)) },
        away: { poolId: b.id, rank: Math.min(rank, Math.max(1, b.teamCount)) },
      });
    }
    return out;
  }
  const p = pools[0]!;
  for (let m = 0; m < pairs; m++) {
    const r1 = m * 2 + 1;
    const r2 = m * 2 + 2;
    out.push({
      home: { poolId: p.id, rank: Math.min(r1, p.teamCount) },
      away: { poolId: p.id, rank: Math.min(r2, p.teamCount) },
    });
  }
  return out;
}

export type WizardScheduleParams = {
  timezone: string;
  startDateYmd: string;
  endDateYmd: string;
  dayStartTime: string;
  dayEndTime: string;
  slotMinutes: number;
  gameDurationMinutes: number;
  minRestMinutes: number;
  travelMinutesBetweenFields: number;
  fieldTravelMatrix?: number[][];
  fieldIds: string[];
};

/**
 * Generate single round-robin for every pool with ≥2 teams inside the tournament window.
 * Pools share fields sequentially; team rest and inter-field travel are enforced.
 */
export async function generateWizardPoolSchedules(
  opts: WizardScheduleParams & { tournamentId: string },
): Promise<{ gamesCreated: number; notes: string[] }> {
  const notes: string[] = [];
  let gamesCreated = 0;

  const pools = await prisma.pool.findMany({
    where: { division: { tournamentId: opts.tournamentId } },
    include: {
      division: { select: { name: true } },
      teams: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }], select: { id: true } },
    },
    orderBy: [{ division: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  const capacity = estimateScheduleCapacity({
    poolTeamCounts: pools.map((p) => p.teams.length),
    fieldCount: opts.fieldIds.length,
    timezone: opts.timezone,
    startDateYmd: opts.startDateYmd,
    endDateYmd: opts.endDateYmd,
    dayStartHm: opts.dayStartTime,
    dayEndHm: opts.dayEndTime,
    slotMinutes: opts.slotMinutes,
    gameDurationMinutes: opts.gameDurationMinutes,
    minRestMinutes: opts.minRestMinutes,
    travelMinutesBetweenFields: opts.travelMinutesBetweenFields,
  });
  notes.push(...capacity.warnings);

  let cursor: SchedulePackingCursor = emptySchedulePackingCursor();
  const windowOpts: ScheduleWindowOpts = {
    timezone: opts.timezone,
    startDateYmd: opts.startDateYmd,
    endDateYmd: opts.endDateYmd,
    dayStartHm: opts.dayStartTime,
    dayEndHm: opts.dayEndTime,
    slotMinutes: opts.slotMinutes,
    gameDurationMinutes: opts.gameDurationMinutes,
    minRestMinutes: opts.minRestMinutes,
    travelMinutesBetweenFields: opts.travelMinutesBetweenFields,
    fieldTravelMatrix: opts.fieldTravelMatrix,
    fieldIds: opts.fieldIds,
  };

  for (const pool of pools) {
    const label = `${pool.division.name} → ${pool.name}`;
    if (pool.teams.length < 2) {
      notes.push(`Skipped schedule for ${label}: need at least 2 teams.`);
      continue;
    }

    const existingCount = await prisma.game.count({
      where: {
        tournamentId: opts.tournamentId,
        poolId: pool.id,
        gameKind: GameKind.POOL,
      },
    });
    if (existingCount > 0) {
      notes.push(`Skipped schedule for ${label}: pool already has games.`);
      continue;
    }

    const pairings = buildRoundRobinPairings(pool.teams.map((t) => t.id));
    const packed = scheduleRoundRobinSlotsInWindow(pairings, windowOpts, cursor);
    cursor = packed.cursor;
    notes.push(...packed.warnings.map((w) => `${label}: ${w}`));

    if (packed.slots.length === 0) {
      notes.push(`Skipped schedule for ${label}: no pairings.`);
      continue;
    }

    await prisma.game.createMany({
      data: packed.slots.map((s) => ({
        tournamentId: opts.tournamentId,
        poolId: pool.id,
        fieldId: s.fieldId,
        homeTeamId: s.homeTeamId,
        awayTeamId: s.awayTeamId,
        scheduledAt: s.scheduledAt,
        status: "SCHEDULED" as const,
        resultType: "REGULAR" as const,
        gameKind: GameKind.POOL,
      })),
    });
    await recomputePoolStandings(pool.id);
    gamesCreated += packed.slots.length;
  }

  return { gamesCreated, notes };
}

/**
 * Create a single-elim playoff per division when sum(teamsAdvancing) is 2–64
 * (pads with byes to the next power of 2).
 */
export async function createWizardSingleElimBrackets(opts: {
  tournamentId: string;
  fieldId: string;
  startsAt: Date;
}): Promise<{ bracketsCreated: number; notes: string[] }> {
  const notes: string[] = [];
  let bracketsCreated = 0;

  const divisions = await prisma.division.findMany({
    where: { tournamentId: opts.tournamentId },
    include: {
      pools: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { teams: true } } },
      },
      brackets: { select: { id: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  for (const division of divisions) {
    if (division.brackets.length > 0) {
      notes.push(`Skipped bracket for ${division.name}: already exists.`);
      continue;
    }

    const advancing = division.pools.reduce((sum, p) => sum + p.teamsAdvancing, 0);
    if (!isValidAdvancingTeamCount(advancing)) {
      notes.push(
        `Skipped bracket for ${division.name}: advancing total is ${advancing} (need 2–64). Adjust advancing counts under Divisions or create the bracket manually.`,
      );
      continue;
    }

    const poolRows = division.pools.map((p) => ({
      id: p.id,
      teamCount: p._count.teams,
    }));
    if (poolRows.some((p) => p.teamCount < 1)) {
      notes.push(`Skipped bracket for ${division.name}: a pool has no teams.`);
      continue;
    }

    // Build interleaved pool/rank slots then pad with byes to power-of-2
    const teamSlots: { poolId: string; rank: number }[] = [];
    const maxAdv = Math.max(...division.pools.map((p) => p.teamsAdvancing), 0);
    for (let rank = 1; rank <= maxAdv; rank++) {
      for (const p of division.pools) {
        if (rank <= p.teamsAdvancing) {
          teamSlots.push({ poolId: p.id, rank });
        }
      }
    }
    const { firstRound: seeded, bracketSize } = padSlotsWithByes(teamSlots.slice(0, advancing));
    const firstRound: FirstRoundSlot[] = seeded.map((s) => ({
      home: s.home.kind === "bye" ? { bye: true as const } : { poolId: s.home.poolId, rank: s.home.rank },
      away: s.away.kind === "bye" ? { bye: true as const } : { poolId: s.away.poolId, rank: s.away.rank },
    }));

    try {
      await createDivisionPlayoffBracket({
        tournamentId: opts.tournamentId,
        divisionId: division.id,
        name: `${division.name} Playoffs`,
        fieldId: opts.fieldId,
        startsAt: opts.startsAt,
        hoursBetweenRounds: 2,
        firstRound,
        published: false,
      });
      bracketsCreated += 1;
      if (bracketSize > advancing) {
        notes.push(
          `${division.name}: ${advancing}-team field padded to ${bracketSize} with ${bracketSize - advancing} bye(s).`,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create bracket";
      notes.push(`Skipped bracket for ${division.name}: ${msg}`);
    }
  }

  return { bracketsCreated, notes };
}

export async function runWizardFinishOptions(
  opts: WizardScheduleParams & {
    tournamentId: string;
    generateSchedules: boolean;
    createBrackets: boolean;
  },
): Promise<WizardFinishResult> {
  const notes: string[] = [];
  let gamesCreated = 0;
  let bracketsCreated = 0;
  let schedulesGenerated = false;

  if (opts.generateSchedules) {
    const rr = await generateWizardPoolSchedules(opts);
    gamesCreated = rr.gamesCreated;
    schedulesGenerated = rr.gamesCreated > 0;
    notes.push(...rr.notes);
    if (rr.gamesCreated > 0) {
      notes.push(
        `Created ${rr.gamesCreated} pool game(s) on ${opts.fieldIds.length} field(s), ${opts.dayStartTime}–${opts.dayEndTime}, ${opts.gameDurationMinutes}-min games / ${opts.slotMinutes}-min slots, ${opts.minRestMinutes}-min rest, ${opts.travelMinutesBetweenFields}-min field travel (${opts.timezone}).`,
      );
    }
  }

  if (opts.createBrackets) {
    const startsAt = parseDatetimeLocalInTimeZone(
      `${opts.startDateYmd}T${opts.dayStartTime}`,
      opts.timezone,
    );
    const br = await createWizardSingleElimBrackets({
      tournamentId: opts.tournamentId,
      fieldId: opts.fieldIds[0]!,
      startsAt,
    });
    bracketsCreated = br.bracketsCreated;
    notes.push(...br.notes);
    if (br.bracketsCreated > 0) {
      notes.push(
        `Created ${br.bracketsCreated} unpublished single-elim bracket(s). Apply standings after pool play.`,
      );
    }
  }

  return { schedulesGenerated, gamesCreated, bracketsCreated, notes };
}
