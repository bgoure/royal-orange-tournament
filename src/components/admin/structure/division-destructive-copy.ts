/**
 * Destructive-action copy for Divisions admin — kept in sync with
 * deleteDivision / deletePool server behavior in structure.ts.
 */

export function divisionDeleteConfirmDescription(): string {
  return "Permanently deletes this division, its pools and teams, and all games, results, and scores for this division. This cannot be undone.";
}

export function divisionDeleteDangerHint(): string {
  return "Deleting permanently removes pools, teams, and all games, results, and scores for this division.";
}

export function poolDeleteConfirmDescription(): string {
  return "Deletion is only possible after this pool is empty and the division’s playoff bracket has been removed. This action does not delete teams or games.";
}

export function poolDeleteDangerHint(teamCount: number): string {
  if (teamCount > 0) {
    return `This pool has ${teamCount} team${teamCount === 1 ? "" : "s"}. Empty the pool and remove the division’s playoff bracket before deleting.`;
  }
  return "Deletion is only possible after the division’s playoff bracket has been removed (if one exists). This does not delete teams or games.";
}
