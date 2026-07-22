/**
 * Pure round-robin pairing helpers (circle method).
 * Odd team counts: the unpaired slot each round is skipped (no bye games in Phase 0).
 */

import { DateTime } from "luxon";

export type RoundRobinPairing = {
  homeTeamId: string;
  awayTeamId: string;
  /** 0-based round index */
  roundIndex: number;
};

/**
 * Build single round-robin pairings for team ids (order preserved as seeding).
 * Returns empty array if fewer than 2 teams.
 */
export function buildRoundRobinPairings(teamIds: string[]): RoundRobinPairing[] {
  if (teamIds.length < 2) return [];

  const ids = [...teamIds];
  const odd = ids.length % 2 === 1;
  if (odd) {
    ids.push("__BYE__");
  }

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const arr = [...ids];
  const out: RoundRobinPairing[] = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i]!;
      const b = arr[n - 1 - i]!;
      if (a === "__BYE__" || b === "__BYE__") continue;
      // Alternate home/away by round for fairness
      if (r % 2 === 0) {
        out.push({ homeTeamId: a, awayTeamId: b, roundIndex: r });
      } else {
        out.push({ homeTeamId: b, awayTeamId: a, roundIndex: r });
      }
    }
    // Rotate all but first fixed position
    const fixed = arr[0]!;
    const rest = arr.slice(1);
    const last = rest.pop()!;
    arr.splice(0, arr.length, fixed, last, ...rest);
  }

  return out;
}

/** Expected game count for a single RR among n teams (byes skipped). */
export function expectedRoundRobinGameCount(teamCount: number): number {
  if (teamCount < 2) return 0;
  return (teamCount * (teamCount - 1)) / 2;
}

export type ScheduledRoundRobinSlot = RoundRobinPairing & {
  scheduledAt: Date;
  fieldId: string;
};

/**
 * Assign start times and fields to pairings.
 * Games in the same round share a time; rounds are spaced by `slotMinutes`.
 * Multiple fields rotate within a round when provided.
 * Note: if a round has more games than fields, multiple games share a field at the same time
 * (legacy behavior). Prefer `scheduleRoundRobinSlotsInWindow` for collision-safe packing.
 */
export function scheduleRoundRobinSlots(
  pairings: RoundRobinPairing[],
  opts: {
    startAt: Date;
    slotMinutes: number;
    fieldIds: string[];
  },
): ScheduledRoundRobinSlot[] {
  if (pairings.length === 0) return [];
  if (opts.fieldIds.length === 0) {
    throw new Error("At least one field is required");
  }
  if (opts.slotMinutes < 1 || opts.slotMinutes > 24 * 60) {
    throw new Error("Slot minutes must be between 1 and 1440");
  }

  const byRound = new Map<number, RoundRobinPairing[]>();
  for (const p of pairings) {
    const list = byRound.get(p.roundIndex) ?? [];
    list.push(p);
    byRound.set(p.roundIndex, list);
  }

  const roundIndexes = [...byRound.keys()].sort((a, b) => a - b);
  const out: ScheduledRoundRobinSlot[] = [];

  for (let ri = 0; ri < roundIndexes.length; ri++) {
    const roundIndex = roundIndexes[ri]!;
    const roundPairings = byRound.get(roundIndex)!;
    const scheduledAt = new Date(opts.startAt.getTime() + ri * opts.slotMinutes * 60_000);
    for (let i = 0; i < roundPairings.length; i++) {
      const p = roundPairings[i]!;
      out.push({
        ...p,
        scheduledAt,
        fieldId: opts.fieldIds[i % opts.fieldIds.length]!,
      });
    }
  }

  return out;
}

export type ScheduleWindowOpts = {
  timezone: string;
  startDateYmd: string;
  endDateYmd: string;
  /** Wall-clock HH:mm — first allowed game start each day. */
  dayStartHm: string;
  /** Wall-clock HH:mm — games must start strictly before this time. */
  dayEndHm: string;
  /** Preferred minutes between successive wave start times. */
  slotMinutes: number;
  /** How long a game occupies a field / keeps a team busy. */
  gameDurationMinutes: number;
  /** Minutes after a game ends before that team may start another. */
  minRestMinutes: number;
  /** Extra minutes when a team's next game is on a different field (travel). Used when matrix has no pair. */
  travelMinutesBetweenFields: number;
  /**
   * Optional N×N travel minutes aligned with `fieldIds` order.
   * `matrix[i][j]` = minutes from `fieldIds[i]` to `fieldIds[j]`. Diagonal ignored.
   */
  fieldTravelMatrix?: number[][];
  fieldIds: string[];
};

/** Travel minutes from one field to another (matrix pair, else uniform default). */
export function travelMinutesBetween(
  fromFieldId: string,
  toFieldId: string,
  opts: Pick<ScheduleWindowOpts, "fieldIds" | "travelMinutesBetweenFields" | "fieldTravelMatrix">,
): number {
  if (fromFieldId === toFieldId) return 0;
  const matrix = opts.fieldTravelMatrix;
  if (matrix && matrix.length === opts.fieldIds.length) {
    const i = opts.fieldIds.indexOf(fromFieldId);
    const j = opts.fieldIds.indexOf(toFieldId);
    if (i >= 0 && j >= 0) {
      const row = matrix[i];
      const cell = row?.[j];
      if (typeof cell === "number" && Number.isFinite(cell) && cell >= 0) {
        return Math.floor(cell);
      }
    }
  }
  return opts.travelMinutesBetweenFields;
}

function parseHm(hm: string): { hour: number; minute: number } {
  const m = /^(\d{2}):(\d{2})$/.exec(hm.trim());
  if (!m) throw new Error("invalid_hm");
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/** How many concurrent waves a pool RR needs given field count (collision-safe). */
export function countRoundRobinWaves(teamCount: number, fieldCount: number): number {
  if (teamCount < 2 || fieldCount < 1) return 0;
  const pairings = buildRoundRobinPairings(
    Array.from({ length: teamCount }, (_, i) => `t${i}`),
  );
  const byRound = new Map<number, number>();
  for (const p of pairings) {
    byRound.set(p.roundIndex, (byRound.get(p.roundIndex) ?? 0) + 1);
  }
  let waves = 0;
  for (const count of byRound.values()) {
    waves += Math.ceil(count / fieldCount);
  }
  return waves;
}

/** Count of valid game-start instants across the tournament date range and daily window. */
export function countAvailableSlotStarts(opts: {
  timezone: string;
  startDateYmd: string;
  endDateYmd: string;
  dayStartHm: string;
  dayEndHm: string;
  slotMinutes: number;
}): number {
  const { hour: sh, minute: sm } = parseHm(opts.dayStartHm);
  const { hour: eh, minute: em } = parseHm(opts.dayEndHm);
  let day = DateTime.fromISO(opts.startDateYmd, { zone: opts.timezone }).startOf("day");
  const last = DateTime.fromISO(opts.endDateYmd, { zone: opts.timezone }).startOf("day");
  if (!day.isValid || !last.isValid || last < day) return 0;

  let count = 0;
  while (day <= last) {
    let slot = day.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
    const dayEnd = day.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
    while (slot.isValid && slot < dayEnd) {
      count += 1;
      slot = slot.plus({ minutes: opts.slotMinutes });
    }
    day = day.plus({ days: 1 });
  }
  return count;
}

export type ScheduleCapacityEstimate = {
  wavesNeeded: number;
  slotsAvailable: number;
  fits: boolean;
  warnings: string[];
};

export type SchedulePackingCursor = {
  nextWaveAt: DateTime | null;
  /** Field id → earliest time the field is free for a new start. */
  fieldFreeAt: Map<string, DateTime>;
  /** Team id → earliest time the team may start another game. */
  teamReadyAt: Map<string, DateTime>;
  /** Team id → field of their last scheduled game. */
  teamLastFieldId: Map<string, string>;
};

export function emptySchedulePackingCursor(): SchedulePackingCursor {
  return {
    nextWaveAt: null,
    fieldFreeAt: new Map(),
    teamReadyAt: new Map(),
    teamLastFieldId: new Map(),
  };
}

/**
 * Estimate whether pool RRs fit into the tournament window, including rest/travel constraints
 * via a dry-run of the same packer.
 */
export function estimateScheduleCapacity(opts: {
  poolTeamCounts: number[];
  fieldCount: number;
  timezone: string;
  startDateYmd: string;
  endDateYmd: string;
  dayStartHm: string;
  dayEndHm: string;
  slotMinutes: number;
  gameDurationMinutes: number;
  minRestMinutes: number;
  travelMinutesBetweenFields: number;
}): ScheduleCapacityEstimate {
  const warnings: string[] = [];
  const fieldCount = Math.max(1, opts.fieldCount);
  const fieldIds = Array.from({ length: fieldCount }, (_, i) => `f${i}`);
  let wavesNeeded = 0;
  for (const tc of opts.poolTeamCounts) {
    if (tc >= 2) wavesNeeded += countRoundRobinWaves(tc, fieldCount);
  }
  const slotsAvailable = countAvailableSlotStarts({
    timezone: opts.timezone,
    startDateYmd: opts.startDateYmd,
    endDateYmd: opts.endDateYmd,
    dayStartHm: opts.dayStartHm,
    dayEndHm: opts.dayEndHm,
    slotMinutes: opts.slotMinutes,
  });

  if (wavesNeeded === 0) {
    warnings.push("No pools with 2+ teams yet — nothing to schedule.");
  } else if (slotsAvailable === 0) {
    warnings.push(
      "No valid time slots in the date range and daily hours — widen the window or shorten slot length.",
    );
  }

  const windowOpts: ScheduleWindowOpts = {
    timezone: opts.timezone,
    startDateYmd: opts.startDateYmd,
    endDateYmd: opts.endDateYmd,
    dayStartHm: opts.dayStartHm,
    dayEndHm: opts.dayEndHm,
    slotMinutes: opts.slotMinutes,
    gameDurationMinutes: opts.gameDurationMinutes,
    minRestMinutes: opts.minRestMinutes,
    travelMinutesBetweenFields: opts.travelMinutesBetweenFields,
    fieldIds,
  };

  let cursor = emptySchedulePackingCursor();
  let dryOverflow = false;
  let poolIndex = 0;
  for (const tc of opts.poolTeamCounts) {
    if (tc < 2) continue;
    const ids = Array.from({ length: tc }, (_, i) => `p${poolIndex}_t${i}`);
    poolIndex += 1;
    const pairings = buildRoundRobinPairings(ids);
    const packed = scheduleRoundRobinSlotsInWindow(pairings, windowOpts, cursor);
    cursor = packed.cursor;
    if (packed.warnings.some((w) => w.toLowerCase().includes("outside"))) {
      dryOverflow = true;
    }
  }

  if (dryOverflow || (wavesNeeded > 0 && wavesNeeded > slotsAvailable)) {
    warnings.push(
      `With rest (${opts.minRestMinutes} min) and field travel (${opts.travelMinutesBetweenFields} min), the schedule may not fit ${opts.startDateYmd}–${opts.endDateYmd} between ${opts.dayStartHm} and ${opts.dayEndHm} on ${fieldCount} field(s). Add fields/days, shorten games, or reduce rest/travel.`,
    );
  }

  return {
    wavesNeeded,
    slotsAvailable,
    fits: wavesNeeded > 0 && !dryOverflow && wavesNeeded <= slotsAvailable,
    warnings,
  };
}

/**
 * Pack RR pairings into a date/time window without double-booking a field,
 * respecting team rest and travel time when switching fields.
 */
export function scheduleRoundRobinSlotsInWindow(
  pairings: RoundRobinPairing[],
  opts: ScheduleWindowOpts,
  cursor?: SchedulePackingCursor,
): { slots: ScheduledRoundRobinSlot[]; warnings: string[]; cursor: SchedulePackingCursor } {
  const warnings: string[] = [];
  const state: SchedulePackingCursor = cursor
    ? {
        nextWaveAt: cursor.nextWaveAt,
        fieldFreeAt: new Map(cursor.fieldFreeAt),
        teamReadyAt: new Map(cursor.teamReadyAt),
        teamLastFieldId: new Map(cursor.teamLastFieldId),
      }
    : emptySchedulePackingCursor();

  if (pairings.length === 0) {
    return { slots: [], warnings, cursor: state };
  }
  if (opts.fieldIds.length === 0) {
    throw new Error("At least one field is required");
  }
  if (opts.slotMinutes < 1 || opts.slotMinutes > 24 * 60) {
    throw new Error("Slot minutes must be between 1 and 1440");
  }
  if (opts.gameDurationMinutes < 1 || opts.gameDurationMinutes > 24 * 60) {
    throw new Error("Game duration must be between 1 and 1440");
  }

  const { hour: sh, minute: sm } = parseHm(opts.dayStartHm);
  const { hour: eh, minute: em } = parseHm(opts.dayEndHm);
  const lastDay = DateTime.fromISO(opts.endDateYmd, { zone: opts.timezone }).startOf("day");
  const firstDay = DateTime.fromISO(opts.startDateYmd, { zone: opts.timezone }).startOf("day");
  if (!firstDay.isValid || !lastDay.isValid) {
    throw new Error("Invalid tournament dates");
  }

  const dayEndOf = (day: DateTime) => day.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
  const dayStartOf = (day: DateTime) => day.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });

  if (!state.nextWaveAt) {
    state.nextWaveAt = dayStartOf(firstDay);
  }

  const advancePastWindow = (from: DateTime): DateTime | null => {
    let t = from;
    for (let guard = 0; guard < 10_000; guard++) {
      const day = t.startOf("day");
      if (day > lastDay) return null;
      const start = dayStartOf(day);
      const end = dayEndOf(day);
      if (t < start) {
        t = start;
        continue;
      }
      if (t < end) return t;
      t = dayStartOf(day.plus({ days: 1 }));
    }
    return null;
  };

  const teamEarliest = (teamId: string, fieldId: string): DateTime | null => {
    const ready = state.teamReadyAt.get(teamId);
    if (!ready) return null;
    const lastField = state.teamLastFieldId.get(teamId);
    const travel =
      lastField && lastField !== fieldId
        ? travelMinutesBetween(lastField, fieldId, opts)
        : 0;
    return ready.plus({ minutes: travel });
  };

  const byRound = new Map<number, RoundRobinPairing[]>();
  for (const p of pairings) {
    const list = byRound.get(p.roundIndex) ?? [];
    list.push(p);
    byRound.set(p.roundIndex, list);
  }
  const roundIndexes = [...byRound.keys()].sort((a, b) => a - b);
  const out: ScheduledRoundRobinSlot[] = [];
  let overflow = false;
  let restOrTravelPushed = false;

  for (const roundIndex of roundIndexes) {
    const roundPairings = byRound.get(roundIndex)!;
    for (let offset = 0; offset < roundPairings.length; offset += opts.fieldIds.length) {
      const wave = roundPairings.slice(offset, offset + opts.fieldIds.length);
      const assignments = wave.map((p, i) => ({
        pairing: p,
        fieldId: opts.fieldIds[i]!,
      }));

      let earliest = state.nextWaveAt ?? dayStartOf(firstDay);
      for (const a of assignments) {
        const fieldFree = state.fieldFreeAt.get(a.fieldId);
        if (fieldFree && fieldFree > earliest) earliest = fieldFree;
        for (const teamId of [a.pairing.homeTeamId, a.pairing.awayTeamId]) {
          const te = teamEarliest(teamId, a.fieldId);
          if (te && te > earliest) {
            earliest = te;
            restOrTravelPushed = true;
          }
        }
      }

      const placed = advancePastWindow(earliest);
      if (!placed) {
        overflow = true;
        const fallback = dayStartOf(lastDay);
        for (const a of assignments) {
          out.push({
            ...a.pairing,
            scheduledAt: fallback.toJSDate(),
            fieldId: a.fieldId,
          });
        }
        state.nextWaveAt = fallback.plus({ minutes: opts.slotMinutes });
        continue;
      }

      const gameEnd = placed.plus({ minutes: opts.gameDurationMinutes });
      const teamReady = gameEnd.plus({ minutes: opts.minRestMinutes });
      for (const a of assignments) {
        out.push({
          ...a.pairing,
          scheduledAt: placed.toJSDate(),
          fieldId: a.fieldId,
        });
        state.fieldFreeAt.set(a.fieldId, gameEnd);
        for (const teamId of [a.pairing.homeTeamId, a.pairing.awayTeamId]) {
          state.teamReadyAt.set(teamId, teamReady);
          state.teamLastFieldId.set(teamId, a.fieldId);
        }
      }
      state.nextWaveAt = placed.plus({ minutes: opts.slotMinutes });
    }
  }

  if (overflow) {
    warnings.push(
      "Some games fall outside the tournament date range or daily hours — widen the window, add fields, shorten games, or reduce rest/travel time.",
    );
  } else if (restOrTravelPushed) {
    warnings.push(
      "Schedule stretched to honor team rest and travel between fields.",
    );
  }

  return { slots: out, warnings, cursor: state };
}
