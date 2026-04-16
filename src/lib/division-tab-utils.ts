import type { DivisionTabDescriptor } from "@/lib/division-tabs";

export const DIVISION_TAB_COOKIE = "tournament_division_tab";

/** Every real division tab id for this tournament (no synthetic "all"). */
export function divisionValidIds(descriptors: { id: string }[]): Set<string> {
  return new Set(descriptors.map((d) => d.id));
}

/**
 * Default selection: first division in `buildDivisionTabDescriptors` order.
 * Empty when there are no divisions.
 */
export function defaultDivisionTabId(descriptors: DivisionTabDescriptor[]): string {
  if (descriptors.length === 0) return "";
  return descriptors[0]!.id;
}

/**
 * Resolve active division: valid `?division=` wins, then cookie if valid for this tournament,
 * then `defaultTabId` (usually first division), else any valid id.
 */
export function resolveDivisionTabForFilters(
  urlDivision: string | undefined,
  cookieValue: string | null,
  valid: Set<string>,
  defaultTabId: string,
): string {
  if (valid.size === 0) return defaultTabId;
  const u = urlDivision?.trim() ?? "";
  if (u && valid.has(u)) return u;
  if (cookieValue && valid.has(cookieValue)) return cookieValue;
  if (valid.has(defaultTabId)) return defaultTabId;
  return [...valid][0]!;
}
