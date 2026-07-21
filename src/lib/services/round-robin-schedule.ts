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
  slotMinutes: number;
  fieldIds: string[];
};

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

/**
 * Estimate whether pool RRs fit into the tournament window (sequential pools, shared fields).
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
}): ScheduleCapacityEstimate {
  const warnings: string[] = [];
  const fieldCount = Math.max(1, opts.fieldCount);
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
  } else if (wavesNeeded > slotsAvailable) {
    warnings.push(
      `Schedule needs about ${wavesNeeded} time slot(s) but only ${slotsAvailable} fit in ${opts.startDateYmd}–${opts.endDateYmd} between ${opts.dayStartHm} and ${opts.dayEndHm} on ${fieldCount} field(s). Add fields, days, or shorten slot length.`,
    );
  }

  return {
    wavesNeeded,
    slotsAvailable,
    fits: wavesNeeded > 0 && wavesNeeded <= slotsAvailable,
    warnings,
  };
}

/**
 * Pack RR pairings into a date/time window without double-booking a field.
 * Same-round games share a start when enough fields exist; overflow becomes the next wave.
 * Advances `cursor` so multiple pools can be scheduled sequentially on the same fields.
 */
export function scheduleRoundRobinSlotsInWindow(
  pairings: RoundRobinPairing[],
  opts: ScheduleWindowOpts,
  cursor?: { nextAt: DateTime | null },
): { slots: ScheduledRoundRobinSlot[]; warnings: string[]; nextAt: DateTime | null } {
  const warnings: string[] = [];
  if (pairings.length === 0) {
    return { slots: [], warnings, nextAt: cursor?.nextAt ?? null };
  }
  if (opts.fieldIds.length === 0) {
    throw new Error("At least one field is required");
  }
  if (opts.slotMinutes < 1 || opts.slotMinutes > 24 * 60) {
    throw new Error("Slot minutes must be between 1 and 1440");
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

  let next =
    cursor?.nextAt && cursor.nextAt.isValid ? cursor.nextAt : dayStartOf(firstDay);

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

  const byRound = new Map<number, RoundRobinPairing[]>();
  for (const p of pairings) {
    const list = byRound.get(p.roundIndex) ?? [];
    list.push(p);
    byRound.set(p.roundIndex, list);
  }
  const roundIndexes = [...byRound.keys()].sort((a, b) => a - b);
  const out: ScheduledRoundRobinSlot[] = [];
  let overflow = false;

  for (const roundIndex of roundIndexes) {
    const roundPairings = byRound.get(roundIndex)!;
    for (let offset = 0; offset < roundPairings.length; offset += opts.fieldIds.length) {
      const wave = roundPairings.slice(offset, offset + opts.fieldIds.length);
      const placed = advancePastWindow(next);
      if (!placed) {
        overflow = true;
        const fallback = dayStartOf(lastDay);
        for (let i = 0; i < wave.length; i++) {
          out.push({
            ...wave[i]!,
            scheduledAt: fallback.toJSDate(),
            fieldId: opts.fieldIds[i]!,
          });
        }
        next = fallback.plus({ minutes: opts.slotMinutes });
        continue;
      }
      for (let i = 0; i < wave.length; i++) {
        out.push({
          ...wave[i]!,
          scheduledAt: placed.toJSDate(),
          fieldId: opts.fieldIds[i]!,
        });
      }
      next = placed.plus({ minutes: opts.slotMinutes });
    }
  }

  if (overflow) {
    warnings.push(
      "Some games fall outside the tournament date range or daily hours — widen the window, add fields, or shorten slot length.",
    );
  }

  return { slots: out, warnings, nextAt: next };
}
