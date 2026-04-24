/**
 * Shared frosted “glass” surfaces for the public tournament site.
 * Matches `GameList` frosted game rows (enabled by default via `glassVariant`).
 */
export const publicGlassSurface =
  "border border-transparent bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:bg-zinc-900/75 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]";

export const publicGlassCard2xl = `min-w-0 rounded-2xl ${publicGlassSurface}`;

export const publicGlassCardXl = `min-w-0 rounded-xl ${publicGlassSurface}`;

/** Quick links: More menu, Social, home grid tiles — royal left rail. */
export const publicGlassLinkTile = `min-w-0 rounded-2xl border border-transparent border-l-2 border-l-royal/90 bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:bg-zinc-900/75 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]`;
