"use client";

type FieldOption = { id: string; label: string };

export type GameListFilter = "all" | "needs_score" | "unscheduled" | "live" | "final";

export type GameListFilterCounts = Record<GameListFilter, number>;

const FILTERS: ReadonlyArray<readonly [GameListFilter, string]> = [
  ["all", "All"],
  ["needs_score", "Needs score"],
  ["unscheduled", "Unscheduled"],
  ["live", "Live"],
  ["final", "Final"],
];

function activeChipClass(id: GameListFilter): string {
  switch (id) {
    case "live":
      return "border-red-600 bg-red-600 text-white";
    case "final":
      return "border-emerald-600 bg-emerald-600 text-white";
    case "needs_score":
    case "unscheduled":
      return "border-amber-600 bg-amber-600 text-white";
    default:
      return "border-zinc-800 bg-zinc-800 text-white";
  }
}

const selectClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";

type Props = {
  shownCount: number;
  totalCount: number;
  fields: readonly FieldOption[];
  fieldFilter: string;
  onFieldFilterChange: (fieldId: string) => void;
  listFilter: GameListFilter;
  onListFilterChange: (filter: GameListFilter) => void;
  counts: GameListFilterCounts;
};

/** Status chips + field picker above the admin game list. */
export function GameListFilters({
  shownCount,
  totalCount,
  fields,
  fieldFilter,
  onFieldFilterChange,
  listFilter,
  onListFilterChange,
  counts,
}: Props) {
  const filtered = listFilter !== "all" || fieldFilter !== "all";

  return (
    <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Game list</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Showing {shownCount} of {totalCount}
            {filtered ? " (filtered)" : ""}, ordered by Game ID. Expand a game for locked details; Edit
            opens a modal.
          </p>
        </div>
        <label className="flex min-w-[12rem] flex-col gap-1">
          <span className={labelClass}>Field</span>
          <select
            value={fieldFilter}
            onChange={(e) => onFieldFilterChange(e.target.value)}
            className={`${selectClass} w-full`}
          >
            <option value="all">All fields</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter games">
        {FILTERS.map(([id, label]) => {
          const active = listFilter === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onListFilterChange(id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? activeChipClass(id) : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {label}
              <span className={`tabular-nums ${active ? "opacity-90" : "text-zinc-500"}`}>
                {counts[id]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
