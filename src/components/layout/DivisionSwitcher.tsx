"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";

export type DivisionOption = { id: string; name: string };

type DivisionSwitcherProps = {
  divisions: DivisionOption[];
  selectedDivision: string;
  onDivisionChange: (divisionId: string) => void;
  disabled?: boolean;
  className?: string;
};

const pillActive =
  "border-2 border-royal bg-royal font-semibold text-white shadow-sm";
const pillInactive =
  "border-2 border-zinc-200 bg-zinc-100 font-medium text-zinc-800 hover:border-zinc-300 hover:bg-zinc-200";
const pillTransition = "transition-colors duration-200 ease-in-out";

/** 44px min touch target on small screens; slightly shorter on md+ */
const tapMin = "min-h-[44px] md:min-h-10";

export function DivisionSwitcher({
  divisions,
  selectedDivision,
  onDivisionChange,
  disabled,
  className,
}: DivisionSwitcherProps) {
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (divisions.length < 2) return;
    const idx = divisions.findIndex((d) => d.id === selectedDivision);
    if (idx < 0) return;
    const el = pillRefs.current[idx];
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [divisions, selectedDivision]);

  if (divisions.length < 2) return null;

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
      {...{ [DIVISION_SWIPE_IGNORE]: "" }}
      className={[
        "flex max-w-full flex-nowrap gap-2 overflow-x-auto overflow-y-visible scroll-smooth pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] md:flex-wrap md:overflow-x-visible md:pb-0",
        "[&::-webkit-scrollbar]:h-1.5",
        "snap-x snap-mandatory md:snap-none",
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
              "snap-start",
              "disabled:pointer-events-none disabled:opacity-50",
              "min-w-0 shrink-0 rounded-lg px-[14px] py-2.5 text-sm",
              "sm:text-base md:min-w-[7.5rem]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2",
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
