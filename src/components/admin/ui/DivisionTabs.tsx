"use client";

type DivisionTabOption = { id: string; name: string };

type Props = {
  divisions: readonly DivisionTabOption[];
  activeDivisionId: string;
  onSelect: (divisionId: string) => void;
  /** Badge count rendered next to each division name. */
  countFor?: (divisionId: string) => number;
  label?: string;
};

/** Division switcher shared by the games and brackets admin screens. */
export function DivisionTabs({
  divisions,
  activeDivisionId,
  onSelect,
  countFor,
  label = "Division",
}: Props) {
  if (divisions.length <= 1) return null;

  return (
    <div
      className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2"
      role="tablist"
      aria-label={label}
    >
      {divisions.map((d) => {
        const selected = activeDivisionId === d.id;
        const count = countFor?.(d.id);
        return (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(d.id)}
            className={
              selected
                ? "rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
            }
          >
            {d.name}
            {count == null ? null : (
              <span className={`ml-1.5 tabular-nums ${selected ? "opacity-80" : "text-zinc-500"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
