import type { DivisionTabDescriptor } from "@/lib/division-tabs";
import { ALL_DIVISIONS_TAB_ID } from "@/lib/division-tabs";

export const DIVISION_TAB_COOKIE = "tournament_division_tab";

/** Home/schedule: All + division ids when multiple tabs exist. */
export function divisionValidIdsWithAll(descriptors: { id: string }[]): Set<string> {
  if (descriptors.length <= 1) return new Set();
  return new Set([ALL_DIVISIONS_TAB_ID, ...descriptors.map((d) => d.id)]);
}

/**
 * First tab id in the division switcher (same order as `SiteHeaderDivisionTabs` / `DivisionSwitcher`).
 * When multiple divisions exist, the first option is always "all".
 */
export function defaultDivisionTabId(descriptors: DivisionTabDescriptor[]): string {
  if (descriptors.length <= 1) return ALL_DIVISIONS_TAB_ID;
  return ALL_DIVISIONS_TAB_ID;
}

/** Valid `?division=` wins; otherwise `defaultTabId` (first tab in the switcher list). */
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
