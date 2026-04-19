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

/** Table header row on public standings when a pool label color is set; otherwise royal / white. */
const STANDINGS_HEADER_ROW: Record<PoolCardLabelColor, string> = {
  ROYAL: "bg-royal text-white",
  ORANGE: "bg-accent text-white",
  EMERALD: "bg-emerald-600 text-white",
  SKY: "bg-sky-600 text-white",
  VIOLET: "bg-violet-600 text-white",
  ROSE: "bg-rose-600 text-white",
  AMBER: "bg-amber-500 text-zinc-900",
  TEAL: "bg-teal-600 text-white",
  INDIGO: "bg-indigo-600 text-white",
  SLATE: "bg-slate-600 text-white",
};

/** PTS column: light tint + matching number color. */
const STANDINGS_PTS_CELL: Record<PoolCardLabelColor, string> = {
  ROYAL: "bg-royal/10 text-royal",
  ORANGE: "bg-accent/10 text-accent",
  EMERALD: "bg-emerald-600/10 text-emerald-600",
  SKY: "bg-sky-600/10 text-sky-600",
  VIOLET: "bg-violet-600/10 text-violet-600",
  ROSE: "bg-rose-600/10 text-rose-600",
  AMBER: "bg-amber-500/15 text-amber-700",
  TEAL: "bg-teal-600/10 text-teal-600",
  INDIGO: "bg-indigo-600/10 text-indigo-600",
  SLATE: "bg-slate-600/10 text-slate-600",
};

/** Section title underline + text (below `border-b-2`). */
const STANDINGS_SECTION_TITLE: Record<PoolCardLabelColor, string> = {
  ROYAL: "border-royal text-royal",
  ORANGE: "border-accent text-accent",
  EMERALD: "border-emerald-600 text-emerald-600",
  SKY: "border-sky-600 text-sky-600",
  VIOLET: "border-violet-600 text-violet-600",
  ROSE: "border-rose-600 text-rose-600",
  AMBER: "border-amber-500 text-amber-700",
  TEAL: "border-teal-600 text-teal-600",
  INDIGO: "border-indigo-600 text-indigo-600",
  SLATE: "border-slate-600 text-slate-600",
};

export function poolStandingsTableHeaderClass(color: PoolCardLabelColor | null | undefined): string {
  if (color == null) return "bg-royal text-white";
  return STANDINGS_HEADER_ROW[color];
}

export function poolStandingsPtsCellClass(color: PoolCardLabelColor | null | undefined): string {
  if (color == null) return "bg-accent/10 text-accent";
  return STANDINGS_PTS_CELL[color];
}

export function poolStandingsSectionTitleClass(color: PoolCardLabelColor | null | undefined): string {
  if (color == null) return "border-royal text-royal";
  return STANDINGS_SECTION_TITLE[color];
}
