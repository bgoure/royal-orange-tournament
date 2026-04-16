import type { DivisionTabDescriptor } from "@/lib/division-tabs";
import { ALL_DIVISIONS_TAB_ID } from "@/lib/division-tabs";

export const DIVISION_TAB_COOKIE = "tournament_division_tab";

/** Home/schedule: All + division ids when multiple tabs exist. */
export function divisionValidIdsWithAll(descriptors: { id: string }[]): Set<string> {
  if (descriptors.length <= 1) return new Set();
  return new Set([ALL_DIVISIONS_TAB_ID, ...descriptors.map((d) => d.id)]);
}

/**
 * Default selection when `?division=` is absent: first **real** division (by `buildDivisionTabDescriptors` order).
 * "All" is not the default when multiple divisions exist.
 */
export function defaultDivisionTabId(descriptors: DivisionTabDescriptor[]): string {
  if (descriptors.length === 0) return ALL_DIVISIONS_TAB_ID;
  return descriptors[0]!.id;
}

/** Valid `?division=` wins; otherwise `defaultTabId` (usually first real division). */
export function resolveDivisionTabForFilters(
  urlDivision: string | undefined,
  valid: Set<string>,
  defaultTabId: string,
): string {
  if (valid.size === 0) return ALL_DIVISIONS_TAB_ID;
  const u = urlDivision?.trim() ?? "";
  if (u && valid.has(u)) return u;
  return valid.has(defaultTabId) ? defaultTabId : ALL_DIVISIONS_TAB_ID;
}
