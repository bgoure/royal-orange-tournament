/** Shared public-bracket layout tokens (current, past/archive, and newly created). */

/** Default round column width — compact; expands only when a single word won't fit. */
export const BRACKET_COL_DEFAULT_PX = 240;
export const BRACKET_COL_MAX_PX = 360;

/** Round column shell (fixed default; chronological may override width inline). */
export const BRACKET_ROUND_COLUMN_CLASS = "flex w-[240px] shrink-0 flex-col";

/** Team / slot labels: wrap only at spaces — never mid-word. */
export const BRACKET_TEAM_NAME_CLASS = "break-normal [overflow-wrap:normal] [word-break:normal]";

/** Logo + gap on one side of a schedule matchup row. */
const SIDE_CHROME_PX = 34;
/** Card padding, vs label, and gutters between the two sides. */
const CARD_CHROME_PX = 56;

let measureCtx: CanvasRenderingContext2D | null | undefined;

function textMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  if (typeof document === "undefined") {
    measureCtx = null;
    return null;
  }
  const canvas = document.createElement("canvas");
  measureCtx = canvas.getContext("2d");
  return measureCtx;
}

/** Width of the longest whitespace-separated token in `text` at the given font. */
export function longestWordWidthPx(text: string, font: string): number {
  const ctx = textMeasureContext();
  if (!ctx) return 0;
  ctx.font = font;
  let max = 0;
  for (const word of text.trim().split(/\s+/)) {
    if (!word) continue;
    max = Math.max(max, ctx.measureText(word).width);
  }
  return max;
}

/**
 * Column width needed so the longest single word fits on one side without mid-word wrap.
 * Stays at the default when city/team words are short enough to wrap naturally at spaces.
 */
export function bracketColumnWidthForLongestWord(longestWordPx: number): number {
  if (longestWordPx <= 0) return BRACKET_COL_DEFAULT_PX;
  const needed = Math.ceil(CARD_CHROME_PX + 2 * (SIDE_CHROME_PX + longestWordPx));
  return Math.min(BRACKET_COL_MAX_PX, Math.max(BRACKET_COL_DEFAULT_PX, needed));
}
