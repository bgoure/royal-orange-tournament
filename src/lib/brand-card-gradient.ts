/** Ten distinct royal / accent / white gradients for public cards (games, sponsors). */
export const BRAND_CARD_GRADIENT_CLASSES = [
  "bg-gradient-to-r from-royal-50 via-white to-accent-50",
  "bg-gradient-to-l from-royal-50 via-white to-accent-50",
  "bg-gradient-to-br from-accent-50 via-white to-royal-50",
  "bg-gradient-to-tr from-royal-50 to-accent-50",
  "bg-gradient-to-bl from-accent-50 to-royal-50",
  "bg-gradient-to-t from-royal-50 via-white to-accent-50",
  "bg-gradient-to-b from-accent-50 via-white to-royal-50",
  "bg-gradient-to-tr from-white via-royal-50 to-accent-50",
  "bg-gradient-to-bl from-white via-accent-50 to-royal-50",
  "bg-gradient-to-r from-accent-50 via-royal-50/50 to-white",
] as const;

function hashString(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Stable gradient per id (SSR-safe, no layout flicker). */
export function brandCardGradientClass(seed: string): string {
  const n = BRAND_CARD_GRADIENT_CLASSES.length;
  return BRAND_CARD_GRADIENT_CLASSES[hashString(seed) % n]!;
}
