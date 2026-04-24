/**
 * Shared frosted “glass” surfaces for the public tournament site.
 * Solid glass: quick links, settings, etc. Game rows use `publicGlassCardOverlay2xl` + gradient (`surfaceResolved`).
 */
export const publicGlassSurface =
  "border border-transparent bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:bg-zinc-900/75 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]";

export const publicGlassCard2xl = `min-w-0 rounded-2xl ${publicGlassSurface}`;

export const publicGlassCardXl = `min-w-0 rounded-xl ${publicGlassSurface}`;

/**
 * Frosted depth without a solid fill — use behind gradients (`GameList` + `surfaceResolved`)
 * so brand gradients stay visible through a translucent surface.
 */
export const publicGlassCardOverlay2xl =
  "min-w-0 rounded-2xl border border-transparent backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]";

/** Quick links: More menu, Social, home grid tiles — royal left rail. */
export const publicGlassLinkTile = `min-w-0 rounded-2xl border border-transparent border-l-2 border-l-royal/90 bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:bg-zinc-900/75 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]`;
