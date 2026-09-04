/**
 * Pure helpers for Locations / Fields admin summaries.
 */

/** First line of an address, trimmed; empty if missing. */
export function shortAddress(address: string | null | undefined, maxLen = 48): string {
  if (!address) return "";
  const line = address.split(/\r?\n/)[0]?.trim() ?? "";
  if (!line) return "";
  if (line.length <= maxLen) return line;
  return `${line.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

/** True when a custom map URL or both coordinates are present. */
export function hasMapLinkAvailability(loc: {
  mapLink?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  if (loc.mapLink?.trim()) return true;
  return loc.latitude != null && loc.longitude != null;
}
