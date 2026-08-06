/**
 * Hard-switch admin tournament cookies, then land on an admin path.
 * Soft Links to bare `/admin/...` can show another event’s cached RSC payload
 * while the shell already shows the newly selected tournament name.
 */
export function adminTournamentSelectHref(slug: string, nextPath: string): string {
  const next = nextPath.startsWith("/admin") ? nextPath : "/admin";
  return `/admin/select/${encodeURIComponent(slug)}?next=${encodeURIComponent(next)}`;
}
