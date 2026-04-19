import type { PoolCardLabelColor } from "@prisma/client";

/** Admin dropdown + must match `PoolCardLabelColor` in Prisma. */
export const POOL_CARD_LABEL_OPTIONS = [
  { value: "ROYAL", label: "Royal blue" },
  { value: "ORANGE", label: "Orange (brand)" },
  { value: "EMERALD", label: "Emerald" },
  { value: "SKY", label: "Sky" },
  { value: "VIOLET", label: "Violet" },
  { value: "ROSE", label: "Rose" },
  { value: "AMBER", label: "Amber" },
  { value: "TEAL", label: "Teal" },
  { value: "INDIGO", label: "Indigo" },
  { value: "SLATE", label: "Slate" },
] as const satisfies ReadonlyArray<{ value: PoolCardLabelColor; label: string }>;

const TEXT_CLASS: Record<PoolCardLabelColor, string> = {
  ROYAL: "text-royal",
  ORANGE: "text-accent",
  EMERALD: "text-emerald-600",
  SKY: "text-sky-600",
  VIOLET: "text-violet-600",
  ROSE: "text-rose-600",
  AMBER: "text-amber-600",
  TEAL: "text-teal-600",
  INDIGO: "text-indigo-600",
  SLATE: "text-slate-600",
};

/** Tailwind classes for pool name on public game cards; empty string = default (inherits muted grey). */
export function poolCardLabelTextClass(color: PoolCardLabelColor | null | undefined): string {
  if (color == null) return "";
  return TEXT_CLASS[color];
}
