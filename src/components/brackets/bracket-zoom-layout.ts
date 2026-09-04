/**
 * Pure layout helpers for the public bracket zoom shell / chrono measure path.
 */

/** Non-immersive scroller: horizontal pan only; document remains the vertical scroller. */
export const NON_IMMERSIVE_BRACKET_SCROLL_CLASS =
  "overflow-x-auto overflow-y-clip overscroll-x-contain pb-2";

/**
 * Reserve document space for a CSS-scaled tree so the horizontal scroller does not
 * clip vertically when scale < 1.
 */
export function reservedZoomHeight(contentH: number, scale: number): number | undefined {
  if (!(contentH > 0) || scale === 1) return undefined;
  return Math.ceil(contentH * scale);
}

/** Treat sub-pixel height churn as unchanged to avoid card/top reflow loops. */
export function sameMeasuredHeights(
  a: Map<string, number>,
  b: Map<string, number>,
  epsilon = 2,
): boolean {
  if (a.size !== b.size) return false;
  for (const [id, h] of b) {
    const prev = a.get(id);
    if (prev == null || Math.abs(prev - h) > epsilon) return false;
  }
  return true;
}
