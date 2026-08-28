/** Games that count as the "latest action" for the public bracket focus window. */
export function gameCountsAsScored(status: string | null | undefined): boolean {
  return status === "FINAL" || status === "LIVE";
}

/**
 * Index of the last column that contains a finalized or live game.
 * Returns -1 when nothing has been scored yet.
 */
export function latestScoredColumnIndex(
  columns: { games: { status?: string | null }[] }[],
): number {
  let last = -1;
  for (let i = 0; i < columns.length; i++) {
    if (columns[i]!.games.some((g) => gameCountsAsScored(g.status))) last = i;
  }
  return last;
}

/**
 * Show one previous round and the next two after the latest scored column.
 * Before any scores, show the first three columns (no previous).
 */
export function focusWindowRange(
  activeIndex: number,
  columnCount: number,
): { lo: number; hi: number } {
  if (columnCount <= 0) return { lo: 0, hi: -1 };
  const active = activeIndex < 0 ? 0 : Math.min(activeIndex, columnCount - 1);
  const lo = Math.max(0, active - 1);
  const hi = Math.min(columnCount - 1, active + 2);
  return { lo, hi };
}

export function isIndexInFocusWindow(index: number, lo: number, hi: number): boolean {
  return index >= lo && index <= hi;
}
