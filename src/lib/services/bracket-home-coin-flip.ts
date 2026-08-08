/**
 * Bracket-only ("direct to brackets") events treat home/away as a coin flip until
 * scorekeeper/admin records field home. Seeded maps still define matchups; seating
 * of known teams at create time is randomized when `enabled`.
 */

export function coinFlipHomeAwaySeats<T extends string | null>(
  homeTeamId: T,
  awayTeamId: T,
  enabled: boolean,
  rng: () => number = Math.random,
): { homeTeamId: T; awayTeamId: T } {
  if (!enabled || homeTeamId == null || awayTeamId == null) {
    return { homeTeamId, awayTeamId };
  }
  if (rng() < 0.5) return { homeTeamId, awayTeamId };
  return { homeTeamId: awayTeamId, awayTeamId: homeTeamId };
}
