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
