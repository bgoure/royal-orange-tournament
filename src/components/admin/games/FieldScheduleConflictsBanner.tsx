export type FieldScheduleConflict = {
  fieldName: string;
  gameA: { id: string; gameNumber: string | null; scheduledAt: Date };
  gameB: { id: string; gameNumber: string | null; scheduledAt: Date };
};

/** How many conflicts to spell out before the list gets noisy. */
const MAX_LISTED = 8;

function gameLabel(game: FieldScheduleConflict["gameA"]): string {
  return game.gameNumber ? `Game #${game.gameNumber}` : game.id.slice(0, 8);
}

/** Warns about existing field double-books; new colliding saves are blocked server-side. */
export function FieldScheduleConflictsBanner({
  conflicts,
}: {
  conflicts: readonly FieldScheduleConflict[];
}) {
  if (conflicts.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p className="font-semibold">
        {conflicts.length} field schedule conflict{conflicts.length === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-xs text-amber-900/90">
        Two games occupy the same field within ~90 minutes. Fix field or start time below — new saves that
        collide are blocked.
      </p>
      <ul className="mt-2 list-inside list-disc text-xs">
        {conflicts.slice(0, MAX_LISTED).map((c, i) => (
          <li key={`${c.gameA.id}-${c.gameB.id}-${i}`}>
            {c.fieldName}: {gameLabel(c.gameA)} vs {gameLabel(c.gameB)}
          </li>
        ))}
      </ul>
    </div>
  );
}
