/**
 * Pure round-robin pairing helpers (circle method).
 * Odd team counts: the unpaired slot each round is skipped (no bye games in Phase 0).
 */

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
