import type { Tournament } from "@prisma/client";

type TournamentPathFields = Pick<Tournament, "slug" | "archiveFolder" | "archivedAt">;

/** Base path for the public tournament site: `/slug` live, or `/folder/slug` when archived. */
export function tournamentPublicBasePath(t: TournamentPathFields): string {
  if (t.archivedAt != null && t.archiveFolder != null && t.archiveFolder.length > 0) {
    return `/${encodeURIComponent(t.archiveFolder)}/${encodeURIComponent(t.slug)}`;
  }
  return `/${encodeURIComponent(t.slug)}`;
}

export function tournamentPathFromBase(basePath: string, ...segments: string[]): string {
  const base = basePath.replace(/\/$/, "");
  const rest = segments.filter(Boolean).join("/");
  return rest ? `${base}/${rest}` : base;
}

/** Public site URLs for a **live** (non-archived) tournament only — e.g. admin “view site” links. */
export function tournamentBasePath(slug: string): string {
  return `/${encodeURIComponent(slug)}`;
}

export function tournamentPath(slug: string, ...segments: string[]): string {
  return tournamentPathFromBase(tournamentBasePath(slug), ...segments);
}

const DIVISION_TAB_SEGMENTS = new Set(["", "schedule", "results", "standings", "brackets"]);

/** Whether division pills apply (home + schedule + results + brackets under this tournament base path). */
export function isDivisionTabBasePath(pathname: string, publicBasePath: string): boolean {
  const base = publicBasePath.replace(/\/$/, "");
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return false;
  const rest = pathname === base ? "" : pathname.slice(base.length + 1);
  const seg = rest.split("/")[0] ?? "";
  return DIVISION_TAB_SEGMENTS.has(seg);
}
