import { getPublishedTournamentBySlug } from "@/lib/tournament-context";

/**
 * Resolves the live (non-archived) published tournament for a `/api/v1/tournaments/{slug}` route.
 * Mirrors the lookup the public `/{slug}` site pages use; archived events are out of scope for v1.
 */
export async function resolveTournamentBySlug(slug: string) {
  return getPublishedTournamentBySlug(slug);
}
