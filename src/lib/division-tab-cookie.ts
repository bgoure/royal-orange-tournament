import { cookies } from "next/headers";
import { ALL_DIVISIONS_TAB_ID } from "@/lib/division-tabs";

export const DIVISION_TAB_COOKIE = "tournament_division_tab";

export async function getDivisionTabCookie(): Promise<string | null> {
  const v = (await cookies()).get(DIVISION_TAB_COOKIE)?.value;
  if (!v || v.trim() === "") return null;
  return v.trim();
}

/** Home/schedule: All + division ids when multiple tabs exist. */
export function divisionValidIdsWithAll(descriptors: { id: string }[]): Set<string> {
  if (descriptors.length <= 1) return new Set();
  return new Set([ALL_DIVISIONS_TAB_ID, ...descriptors.map((d) => d.id)]);
}

/** Standings: only concrete division tab ids (no “All”). */
export function divisionValidIdsStandingsOnly(descriptors: { id: string }[]): Set<string> {
  if (descriptors.length <= 1) return new Set();
  return new Set(descriptors.map((d) => d.id));
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

/** URL wins; else cookie; else first tab id. */
export function resolveDivisionTabForStandings(
  urlDivision: string | undefined,
  cookieValue: string | null,
  valid: Set<string>,
  firstTabId: string,
): string {
  if (valid.size === 0) return firstTabId;
  const u = urlDivision?.trim() ?? "";
  if (u && valid.has(u)) return u;
  if (cookieValue && valid.has(cookieValue)) return cookieValue;
  return firstTabId;
}
