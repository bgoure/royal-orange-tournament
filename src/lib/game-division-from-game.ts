/** Minimal shape for resolving division id from a loaded game (pool, consolation, or bracket). */
export type GameDivisionSource = {
  pool?: { division?: { id: string } } | null;
  division?: { id: string } | null;
  bracketRound?: { bracket?: { division?: { id: string } } } | null;
};

export function gameDivisionIdForFavorites(g: GameDivisionSource): string | undefined {
  return g.pool?.division?.id ?? g.division?.id ?? g.bracketRound?.bracket?.division?.id ?? undefined;
}
