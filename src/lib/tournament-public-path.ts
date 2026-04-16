/** Public site URLs are scoped by published tournament slug, e.g. /10U11U/schedule */

export function tournamentBasePath(slug: string): string {
  return `/${encodeURIComponent(slug)}`;
}

export function tournamentPath(slug: string, ...segments: string[]): string {
  const rest = segments.filter(Boolean).join("/");
  return rest ? `${tournamentBasePath(slug)}/${rest}` : tournamentBasePath(slug);
}

const DIVISION_TAB_SEGMENTS = new Set(["", "schedule", "standings", "brackets"]);

/** Whether division pills apply (home + schedule + standings + brackets under this slug). */
export function isDivisionTabBasePath(pathname: string, slug: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== slug) return false;
  const seg = parts[1] ?? "";
  return DIVISION_TAB_SEGMENTS.has(seg);
}
