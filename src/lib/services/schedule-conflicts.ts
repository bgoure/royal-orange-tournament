/**
 * Field double-book detection for manual schedule edits.
 * Games have no stored duration — occupancy defaults to 90 minutes (typical youth slot).
 */

import { prisma } from "@/lib/db";
import { formatGameScheduledAt } from "@/lib/datetime-tournament";
import { isOba13AlternateEndgameSlot } from "@/lib/services/oba-de-13";

export const DEFAULT_FIELD_OCCUPANCY_MINUTES = 90;

export type ScheduledFieldSlot = {
  id: string;
  fieldId: string;
  scheduledAt: Date;
  status?: string | null;
  gameNumber?: string | null;
  /** Same-bracket A/B endgame games (13-team OBA) may share a field slot. */
  bracketId?: string | null;
};

/** True when [aStart, aEnd) overlaps [bStart, bEnd). */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function fieldOccupancyEnd(scheduledAt: Date, durationMinutes: number): Date {
  return new Date(scheduledAt.getTime() + durationMinutes * 60_000);
}

/**
 * Pure: find pairs of games on the same field whose occupancy windows overlap.
 * CANCELLED games are ignored (field is free).
 */
export function findOverlappingFieldPairs(
  games: ScheduledFieldSlot[],
  durationMinutes: number = DEFAULT_FIELD_OCCUPANCY_MINUTES,
): Array<{ a: ScheduledFieldSlot; b: ScheduledFieldSlot }> {
  const active = games.filter((g) => g.status !== "CANCELLED");
  const byField = new Map<string, ScheduledFieldSlot[]>();
  for (const g of active) {
    const list = byField.get(g.fieldId) ?? [];
    list.push(g);
    byField.set(g.fieldId, list);
  }

  const pairs: Array<{ a: ScheduledFieldSlot; b: ScheduledFieldSlot }> = [];
  for (const list of byField.values()) {
    const sorted = [...list].sort((x, y) => x.scheduledAt.getTime() - y.scheduledAt.getTime());
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]!;
      const aEnd = fieldOccupancyEnd(a.scheduledAt, durationMinutes);
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]!;
        if (b.scheduledAt.getTime() >= aEnd.getTime()) break;
        if (
          a.bracketId &&
          a.bracketId === b.bracketId &&
          isOba13AlternateEndgameSlot(a.gameNumber, b.gameNumber)
        ) {
          continue;
        }
        const bEnd = fieldOccupancyEnd(b.scheduledAt, durationMinutes);
        if (intervalsOverlap(a.scheduledAt, aEnd, b.scheduledAt, bEnd)) {
          pairs.push({ a, b });
        }
      }
    }
  }
  return pairs;
}

/**
 * Returns an error message if another non-cancelled, non-placeholder game already occupies
 * the field for the proposed start (using default occupancy window).
 *
 * TBD / `schedulePlaceholder` bracket slots are ignored — they share a wizard seed time until
 * staff assigns a real slot (same as the admin conflict banner).
 */
export async function assertNoFieldScheduleConflict(opts: {
  tournamentId: string;
  fieldId: string;
  scheduledAt: Date;
  excludeGameId?: string;
  durationMinutes?: number;
  /** Tournament IANA zone — used only to phrase the error. */
  timeZone?: string;
}): Promise<string | null> {
  const duration = opts.durationMinutes ?? DEFAULT_FIELD_OCCUPANCY_MINUTES;
  // Any game starting in (T - duration, T + duration) can overlap a duration-long slot at T.
  const windowStart = new Date(opts.scheduledAt.getTime() - duration * 60_000);
  const windowEnd = fieldOccupancyEnd(opts.scheduledAt, duration);

  const candidates = await prisma.game.findMany({
    where: {
      tournamentId: opts.tournamentId,
      fieldId: opts.fieldId,
      status: { not: "CANCELLED" },
      schedulePlaceholder: false,
      ...(opts.excludeGameId ? { id: { not: opts.excludeGameId } } : {}),
      scheduledAt: {
        gt: windowStart,
        lt: windowEnd,
      },
    },
    select: {
      id: true,
      scheduledAt: true,
      gameNumber: true,
      bracketId: true,
      field: { select: { name: true } },
    },
    take: 20,
  });

  let self: { gameNumber: string | null; bracketId: string | null } | null = null;
  if (opts.excludeGameId) {
    self = await prisma.game.findFirst({
      where: { id: opts.excludeGameId, tournamentId: opts.tournamentId },
      select: { gameNumber: true, bracketId: true },
    });
  }

  const conflicting = candidates.filter((c) => {
    if (
      self?.bracketId &&
      c.bracketId === self.bracketId &&
      isOba13AlternateEndgameSlot(self.gameNumber, c.gameNumber)
    ) {
      return false;
    }
    return intervalsOverlap(
      opts.scheduledAt,
      windowEnd,
      c.scheduledAt,
      fieldOccupancyEnd(c.scheduledAt, duration),
    );
  });

  if (conflicting.length === 0) return null;

  const first = conflicting[0]!;
  const gn = first.gameNumber ? `Game #${first.gameNumber}` : "Another game";
  const fieldName = first.field?.name ?? "this field";
  const when = opts.timeZone
    ? formatGameScheduledAt(first.scheduledAt, opts.timeZone)
    : first.scheduledAt.toISOString();
  return `${gn} is already on ${fieldName} at ${when} (assumes ~${duration}-min field slots). Pick a different field or time.`;
}

/**
 * Older OBA seeded brackets marked first-round games (both teams known) as real
 * field bookings at the shared create-form start time. Only repair clusters where
 * every game in the slot is still non-TBD (the original bug). Mixed clusters are
 * left alone so a freshly saved real slot is not flipped back to TBD.
 */
export async function repairClusteredBracketSeedPlaceholders(tournamentId: string): Promise<number> {
  const games = await prisma.game.findMany({
    where: {
      tournamentId,
      gameKind: "PLAYOFF",
      status: { not: "CANCELLED" },
    },
    select: { id: true, fieldId: true, scheduledAt: true, schedulePlaceholder: true, gameNumber: true, bracketId: true },
  });

  const groups = new Map<string, typeof games>();
  for (const g of games) {
    const key = `${g.fieldId}:${g.scheduledAt.getTime()}`;
    const list = groups.get(key) ?? [];
    list.push(g);
    groups.set(key, list);
  }

  const toFix = [...groups.values()]
    .map((list) =>
      list.filter((g, i) =>
        list.every(
          (other, j) =>
            i === j ||
            !other.bracketId ||
            other.bracketId !== g.bracketId ||
            !isOba13AlternateEndgameSlot(g.gameNumber, other.gameNumber),
        ),
      ),
    )
    .filter((list) => list.length > 1 && list.every((g) => !g.schedulePlaceholder))
    .flatMap((list) => list.map((g) => g.id));
  if (toFix.length === 0) return 0;

  await prisma.game.updateMany({
    where: { id: { in: toFix } },
    data: { schedulePlaceholder: true },
  });
  return toFix.length;
}

/** List current double-books for an admin banner. */
export async function listFieldScheduleConflicts(
  tournamentId: string,
  durationMinutes: number = DEFAULT_FIELD_OCCUPANCY_MINUTES,
) {
  const games = await prisma.game.findMany({
    where: {
      tournamentId,
      status: { not: "CANCELLED" },
      schedulePlaceholder: false,
    },
    select: {
      id: true,
      fieldId: true,
      scheduledAt: true,
      status: true,
      gameNumber: true,
      bracketId: true,
      field: { select: { name: true } },
    },
  });

  const pairs = findOverlappingFieldPairs(games, durationMinutes);
  return pairs.map(({ a, b }) => {
    const aRow = games.find((g) => g.id === a.id)!;
    const bRow = games.find((g) => g.id === b.id)!;
    return {
      fieldName: aRow.field.name,
      gameA: {
        id: a.id,
        gameNumber: aRow.gameNumber ?? null,
        scheduledAt: a.scheduledAt,
      },
      gameB: {
        id: b.id,
        gameNumber: bRow.gameNumber ?? null,
        scheduledAt: b.scheduledAt,
      },
    };
  });
}
