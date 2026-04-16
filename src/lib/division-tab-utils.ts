import { ALL_DIVISIONS_TAB_ID } from "@/lib/division-tabs";

export const DIVISION_TAB_COOKIE = "tournament_division_tab";

/** Home/schedule: All + division ids when multiple tabs exist. */
export function divisionValidIdsWithAll(descriptors: { id: string }[]): Set<string> {
  if (descriptors.length <= 1) return new Set();
  return new Set([ALL_DIVISIONS_TAB_ID, ...descriptors.map((d) => d.id)]);
}

/** URL wins if valid; else cookie if valid; else all. */
export function resolveDivisionTabForFilters(
  urlDivision: string | undefined,
  cookieValue: string | null,
  valid: Set<string>,
): string {
  if (valid.size === 0) return ALL_DIVISIONS_TAB_ID;
  const u = urlDivision?.trim() ?? "";
  if (u && valid.has(u)) return u;
  if (cookieValue && valid.has(cookieValue)) return cookieValue;
  return ALL_DIVISIONS_TAB_ID;
}
