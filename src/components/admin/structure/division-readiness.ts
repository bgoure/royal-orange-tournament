/**
 * Pure helpers for Divisions admin summaries (no DOM / React / DB).
 */
import type { BracketFormat } from "@prisma/client";

export type DivisionBracketSummary = {
  format: BracketFormat;
  published: boolean;
  name: string;
  presetKey: string | null;
} | null;

export type DivisionReadinessInput = {
  poolCount: number;
  teamCount: number;
  bracket: DivisionBracketSummary;
};

export type DivisionReadiness = {
  label: string;
  tone: "neutral" | "warning" | "info" | "success";
  formatLabel: string | null;
};

const FORMAT_LABELS: Record<string, string> = {
  SINGLE_ELIMINATION: "Single elim",
  DOUBLE_ELIMINATION: "Double elim",
  TRIPLE_ELIMINATION: "Triple elim",
};

export function bracketFormatLabel(format: BracketFormat | string | null | undefined): string | null {
  if (!format) return null;
  return FORMAT_LABELS[format] ?? String(format);
}

/** Derive scannable readiness for a division summary card. */
export function divisionReadiness(input: DivisionReadinessInput): DivisionReadiness {
  const formatLabel = input.bracket ? bracketFormatLabel(input.bracket.format) : null;

  if (input.poolCount === 0) {
    return { label: "Add pools", tone: "warning", formatLabel };
  }
  if (input.teamCount === 0) {
    return { label: "Needs teams", tone: "warning", formatLabel };
  }
  if (!input.bracket) {
    return { label: "Pool play ready", tone: "info", formatLabel: null };
  }
  if (input.bracket.published) {
    return { label: "Bracket published", tone: "success", formatLabel };
  }
  return { label: "Bracket draft", tone: "info", formatLabel };
}

export function countTeamsInPools(pools: readonly { teams: readonly unknown[] }[]): number {
  return pools.reduce((sum, p) => sum + p.teams.length, 0);
}
