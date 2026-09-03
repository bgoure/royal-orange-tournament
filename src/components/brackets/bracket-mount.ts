/**
 * Mounting contract for the public bracket tree.
 *
 * A bracket renders exactly ONE interactive tree. Phones and desktop share that
 * mount and differ only through responsive CSS inside it. Rendering a second copy
 * behind `hidden md:block` / `md:hidden` keeps both copies live in the DOM, so every
 * measurement pass, ResizeObserver callback and SVG join-path rebuild runs twice on
 * phones — the exact cost the round-focus window exists to avoid.
 */

export type BracketTreeMount = {
  key: string;
  /** Wrapper classes for the mount. Must not gate visibility per breakpoint. */
  className: string;
};

/** `hidden`, or a breakpoint-scoped display switch such as `md:hidden` / `md:block`. */
const BREAKPOINT_VISIBILITY =
  /(?:^|\s)(?:hidden|(?:sm|md|lg|xl|2xl):(?:hidden|block|flex|grid|inline-flex|inline-block))(?=\s|$)/;

export function hasResponsiveVisibilityToggle(className: string): boolean {
  return BREAKPOINT_VISIBILITY.test(className.trim());
}

/** The tree mounts for one bracket — always a single entry. */
export function bracketTreeMounts(bracketId: string): BracketTreeMount[] {
  return [{ key: `bracket-tree-${bracketId}`, className: "mt-4" }];
}

/**
 * Unwraps the one mount a bracket is allowed to render. Throws when a caller adds a
 * breakpoint-specific duplicate, so a dual-mount regression fails loudly instead of
 * silently doubling layout work on mobile.
 */
export function assertSingleInteractiveTree(mounts: BracketTreeMount[]): BracketTreeMount {
  const mount = mounts[0];
  if (mounts.length !== 1 || !mount) {
    throw new Error(
      `Bracket must mount exactly one interactive tree, received ${mounts.length}.`,
    );
  }
  if (hasResponsiveVisibilityToggle(mount.className)) {
    throw new Error(
      `Bracket tree mount "${mount.key}" hides itself at a breakpoint, which implies a duplicate mount for the other breakpoint.`,
    );
  }
  return mount;
}
