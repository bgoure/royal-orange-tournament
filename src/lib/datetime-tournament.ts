import { DateTime } from "luxon";

/**
 * Parses a `datetime-local` value (no offset) as a wall-clock time in the tournament's IANA timezone
 * and returns the corresponding UTC `Date`.
 *
 * Server-side `new Date("YYYY-MM-DDTHH:mm")` treats the string as UTC, which mis-schedules games
 * when the Node runtime uses UTC (e.g. Vercel). Organizers expect times in the tournament venue zone.
 */
export function parseDatetimeLocalInTimeZone(raw: string, timeZone: string): Date {
  const trimmed = raw.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!m) {
    throw new Error("invalid_datetime_format");
  }

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const sec = m[6] != null ? Number(m[6]) : 0;

  const dt = DateTime.fromObject(
    { year: y, month: mo, day: d, hour: h, minute: mi, second: sec },
    { zone: timeZone },
  );
  if (!dt.isValid) {
    throw new Error(dt.invalidReason ?? "invalid_datetime");
  }
  return dt.toJSDate();
}

/** Format a UTC instant for `<input type="datetime-local">` in the tournament timezone. */
export function formatJsDateAsDatetimeLocalInZone(date: Date, timeZone: string): string {
  const dt = DateTime.fromMillis(date.getTime()).setZone(timeZone);
  if (!dt.isValid) return "";
  return dt.toFormat("yyyy-MM-dd'T'HH:mm");
}

/**
 * Format a game instant for the public schedule using the tournament venue timezone.
 * Always pass `timeZone` from `tournament.timezone` so server (often UTC) and browsers agree
 * on the wall-clock time organizers intended.
 */
export function formatGameScheduledAt(d: Date, timeZone?: string | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  if (timeZone?.trim()) {
    opts.timeZone = timeZone.trim();
  } else {
    opts.timeZoneName = "short";
  }
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

/** Compact variant for horizontal game cards on home. */
export function formatGameScheduledAtShort(d: Date, timeZone?: string | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  };
  if (timeZone?.trim()) {
    opts.timeZone = timeZone.trim();
  } else {
    opts.timeZoneName = "short";
  }
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

/** Bracket match cards (month/day, no weekday). Use `schedulePlaceholder` to show TBD instead of a concrete time. */
export function formatBracketGameScheduledAt(
  d: Date,
  timeZone?: string | null,
  schedulePlaceholder?: boolean,
): string {
  if (schedulePlaceholder) return "TBD";
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  if (timeZone?.trim()) opts.timeZone = timeZone.trim();
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

/** Time only for the Game ID row (date lives on the round column title). */
export function formatBracketGameTimeOnly(
  d: Date,
  timeZone?: string | null,
  schedulePlaceholder?: boolean,
): string {
  if (schedulePlaceholder) return "TBD";
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  if (timeZone?.trim()) opts.timeZone = timeZone.trim();
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

/** Long month + day for round headers, e.g. "August 9". */
export function formatBracketRoundDayLabel(
  d: Date,
  timeZone?: string | null,
): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
  };
  if (timeZone?.trim()) opts.timeZone = timeZone.trim();
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

/**
 * Earliest non-TBD game day in a round/column, or null when every game is still a placeholder.
 */
export function earliestBracketRoundDayLabel(
  games: ReadonlyArray<{ scheduledAt: Date | string; schedulePlaceholder?: boolean | null }>,
  timeZone?: string | null,
): string | null {
  let earliest: Date | null = null;
  for (const g of games) {
    if (g.schedulePlaceholder) continue;
    const at = typeof g.scheduledAt === "string" ? new Date(g.scheduledAt) : g.scheduledAt;
    if (Number.isNaN(at.getTime())) continue;
    if (earliest == null || at.getTime() < earliest.getTime()) earliest = at;
  }
  if (!earliest) return null;
  return formatBracketRoundDayLabel(earliest, timeZone);
}

/** e.g. "Round 1 - August 9" when a real day is known. */
export function withBracketRoundDay(
  baseLabel: string,
  games: ReadonlyArray<{ scheduledAt: Date | string; schedulePlaceholder?: boolean | null }>,
  timeZone?: string | null,
): string {
  const day = earliestBracketRoundDayLabel(games, timeZone);
  if (!day) return baseLabel;
  return `${baseLabel} - ${day}`;
}

/** `YYYY-MM-DD` in tournament zone (matches public schedule `day` query values). */
export function tournamentCalendarDayKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone.trim(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Sticky schedule group label, e.g. "Friday, July 12". */
export function formatScheduleDayGroupHeading(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone.trim(),
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}
