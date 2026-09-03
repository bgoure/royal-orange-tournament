import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  align?: "start" | "end" | "between";
  /** Adds a top divider — use when the bar closes a form or card. */
  bordered?: boolean;
  className?: string;
};

const alignClass = {
  start: "justify-start",
  end: "justify-end",
  between: "justify-between",
} as const;

/** Row of buttons/links with consistent wrapping and spacing. */
export function ActionBar({ children, align = "start", bordered = false, className = "" }: Props) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${alignClass[align]} ${
        bordered ? "border-t border-zinc-100 pt-4" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
