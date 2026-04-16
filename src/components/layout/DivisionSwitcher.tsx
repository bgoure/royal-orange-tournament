"use client";

export type DivisionOption = { id: string; name: string };

type DivisionSwitcherProps = {
  divisions: DivisionOption[];
  selectedDivision: string;
  onDivisionChange: (divisionId: string) => void;
  disabled?: boolean;
  className?: string;
};

const pillActive =
  "border-2 border-transparent bg-accent text-white shadow-sm";
const pillInactive =
  "border-2 border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50";
const pillTransition = "transition-colors duration-200 ease-out";

/** 44px min touch target on small screens; slightly shorter on md+ */
const tapMin = "min-h-[44px] md:min-h-10";

const selectClass = [
  tapMin,
  "w-full rounded-xl border border-zinc-200/90 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm outline-none transition-colors",
  "md:w-auto md:max-w-[20rem]",
  "focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-60",
].join(" ");

export function DivisionSwitcher({
  divisions,
  selectedDivision,
  onDivisionChange,
  disabled,
  className,
}: DivisionSwitcherProps) {
  if (divisions.length < 2) return null;

  if (divisions.length === 2) {
    return (
      <div
        className={[
          "flex w-full max-w-full flex-wrap gap-2",
          "md:inline-flex md:w-auto md:max-w-none md:flex-nowrap",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        role="group"
        aria-label="Division"
      >
        {divisions.map((d) => {
          const active = d.id === selectedDivision;
          return (
            <button
              key={d.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onDivisionChange(d.id)}
              className={[
                tapMin,
                pillTransition,
                "disabled:pointer-events-none disabled:opacity-50",
                "min-w-0 flex-1 rounded-full px-3 py-2 text-sm font-medium",
                "sm:text-base md:w-auto md:flex-none md:min-w-[7.5rem] md:px-4",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                active ? pillActive : pillInactive,
              ].join(" ")}
            >
              {d.name}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <label
      className={["block w-full md:w-auto md:max-w-[20rem]", className].filter(Boolean).join(" ")}
    >
      <span className="sr-only">Division</span>
      <select
        className={selectClass}
        disabled={disabled}
        value={selectedDivision}
        onChange={(e) => onDivisionChange(e.target.value)}
      >
        {divisions.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}
