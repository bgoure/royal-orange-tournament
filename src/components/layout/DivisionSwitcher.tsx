"use client";

import { useId, useRef, type KeyboardEvent } from "react";

export type DivisionOption = { id: string; name: string };

type DivisionSwitcherProps = {
  divisions: DivisionOption[];
  selectedDivision: string;
  onDivisionChange: (divisionId: string) => void;
  disabled?: boolean;
  className?: string;
};

const pillActive =
  "border-2 border-transparent bg-accent font-semibold text-white shadow-sm";
const pillInactive =
  "border-2 border-gray-300 bg-white font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50";
const pillTransition = "transition-colors duration-200 ease-out";

/** 44px min touch target on small screens; slightly shorter on md+ */
const tapMin = "min-h-[44px] md:min-h-10";

/** Native select styled to match inactive pill buttons + chevron affordance */
const selectClass = [
  tapMin,
  pillTransition,
  "w-full min-w-[12rem] max-w-[20rem] cursor-pointer appearance-none rounded-lg border-2 border-gray-300 bg-white px-4 py-2 pr-10",
  "text-sm font-medium text-gray-700 shadow-sm",
  "sm:text-base",
  "hover:border-gray-400 hover:bg-gray-50",
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35 focus:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

function SelectChevron() {
  return (
    <span
      className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
      aria-hidden
    >
      <svg
        className="size-5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}

export function DivisionSwitcher({
  divisions,
  selectedDivision,
  onDivisionChange,
  disabled,
  className,
}: DivisionSwitcherProps) {
  const selectId = useId();
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (divisions.length < 2) return null;

  const usePillSwitcher = divisions.length === 2;

  if (usePillSwitcher) {
    const onPillKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (disabled) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = (index + 1) % divisions.length;
        onDivisionChange(divisions[next]!.id);
        queueMicrotask(() => pillRefs.current[next]?.focus());
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = (index - 1 + divisions.length) % divisions.length;
        onDivisionChange(divisions[prev]!.id);
        queueMicrotask(() => pillRefs.current[prev]?.focus());
      }
    };

    return (
      <div
        className={[
          "flex w-auto max-w-full flex-wrap justify-end gap-2",
          "md:inline-flex md:max-w-none md:flex-nowrap md:justify-end",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        role="radiogroup"
        aria-label="Division"
      >
        {divisions.map((d, index) => {
          const active = d.id === selectedDivision;
          return (
            <button
              key={d.id}
              ref={(el) => {
                pillRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              disabled={disabled}
              tabIndex={active ? 0 : -1}
              aria-checked={active}
              aria-current={active ? "true" : undefined}
              onClick={() => onDivisionChange(d.id)}
              onKeyDown={(e) => onPillKeyDown(e, index)}
              className={[
                tapMin,
                pillTransition,
                "disabled:pointer-events-none disabled:opacity-50",
                "min-w-0 shrink-0 rounded-full px-3 py-2 text-sm",
                "sm:text-base md:min-w-[7.5rem] md:px-4",
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
    <div
      className={["relative w-full max-w-[20rem] min-w-[12rem]", className].filter(Boolean).join(" ")}
    >
      <select
        id={selectId}
        className={selectClass}
        aria-label="Division"
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
      <SelectChevron />
    </div>
  );
}
