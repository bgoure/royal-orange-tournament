import type { ReactNode } from "react";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "live";

const toneClass: Record<StatusTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200",
  info: "bg-sky-100 text-sky-950 ring-1 ring-sky-200",
  success: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200",
  warning: "bg-amber-100 text-amber-950 ring-1 ring-amber-200",
  danger: "bg-red-100 text-red-800 ring-1 ring-red-200",
  live: "bg-red-600 text-white ring-1 ring-red-700",
};

type Props = {
  tone?: StatusTone;
  children: ReactNode;
  /** Adds a dot before the label for at-a-glance scanning. */
  withDot?: boolean;
  className?: string;
};

/** Pill used for publish state, game status, archive state, etc. */
export function StatusBadge({ tone = "neutral", children, withDot = false, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${toneClass[tone]} ${className}`}
    >
      {withDot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}
