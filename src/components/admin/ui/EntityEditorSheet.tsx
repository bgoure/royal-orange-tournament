"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { Drawer } from "vaul";

type DrawerDirection = "bottom" | "right";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Subtitle shown beneath the title (e.g. entity name when editing). */
  subtitle?: ReactNode;
  /** Narrative description placed above the form; read by screen readers. */
  description?: ReactNode;
  /** The main form body — should include all interactive fields. */
  children: ReactNode;
  /**
   * Sticky footer contents.  Render Cancel and Save buttons here so they stay
   * visible while the form body scrolls.  The sheet provides no default buttons
   * so callers can customise pending state, destructive actions, etc.
   */
  footer: ReactNode;
  /**
   * Optional extra section rendered after the footer inside the scroll area,
   * intended for the "Danger zone" delete section with visual separation.
   */
  dangerZone?: ReactNode;
  /**
   * Nested overlays (e.g. ConfirmDialog with `contained`) rendered *inside*
   * Drawer.Content so they remain interactive under Radix's modal pointer-events
   * isolation. Do not render modal confirms as siblings outside this tree.
   */
  overlay?: ReactNode;
  /**
   * Called when the user attempts to close the sheet (Escape, backdrop click,
   * or a Cancel button inside `footer`).  If you want to guard against unsaved
   * changes or a nested confirmation, return false here.  The default
   * (undefined) always closes.
   */
  onCloseAttempt?: () => boolean;
  /**
   * When false, Escape / backdrop / drag dismiss are disabled.  Use while a
   * nested ConfirmDialog is open so only the confirmation can dismiss.
   * @default true
   */
  dismissible?: boolean;
};

const LG_QUERY = "(min-width: 1024px)";

/**
 * Responsive Vaul direction without hydration mismatch: SSR and first paint
 * use bottom; after mount we switch to right on lg+ viewports.
 */
function useResponsiveDrawerDirection(): DrawerDirection {
  const [direction, setDirection] = useState<DrawerDirection>("bottom");

  useEffect(() => {
    const mq = window.matchMedia(LG_QUERY);
    const sync = () => setDirection(mq.matches ? "right" : "bottom");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return direction;
}

/**
 * Accessible editor panel built on vaul Drawer (Radix Dialog underneath).
 *
 * Responsive layout:
 *   – Phone / tablet: bottom sheet (`direction="bottom"`)
 *   – lg+:            right-side drawer (`direction="right"`)
 *
 * Accessibility relies on Vaul/Radix for focus trap, Escape, and focus return.
 * Nested confirmations must use the `overlay` slot (DOM child of Content) with
 * ConfirmDialog `contained`, plus `dismissible={false}` while open, so Escape
 * and pointer events stay on the confirmation without weakening modal focus.
 */
export function EntityEditorSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  description,
  children,
  footer,
  dangerZone,
  overlay,
  onCloseAttempt,
  dismissible = true,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const direction = useResponsiveDrawerDirection();

  // Belt-and-suspenders body scroll lock (Vaul also manages this when modal).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        if (!dismissible) return;
        if (onCloseAttempt && !onCloseAttempt()) return;
      }
      onOpenChange(next);
    },
    [onOpenChange, onCloseAttempt, dismissible],
  );

  const isRight = direction === "right";

  return (
    <Drawer.Root
      open={open}
      onOpenChange={handleOpenChange}
      direction={direction}
      dismissible={dismissible}
      autoFocus
      modal
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/40" />

        <Drawer.Content
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          className={[
            // Contained ConfirmDialog overlays use absolute inset-0; a `fixed`
            // Content node is already a containing block for those absolutes.
            "fixed z-[80] flex flex-col bg-white outline-none",
            isRight
              ? "bottom-0 right-0 top-0 h-full w-full max-w-lg rounded-l-2xl shadow-2xl"
              : "bottom-0 left-0 right-0 max-h-[92vh] rounded-t-2xl",
          ].join(" ")}
        >
          {/* Drag handle — mobile/tablet bottom sheet only */}
          {!isRight ? (
            <div className="flex shrink-0 justify-center pt-3" aria-hidden>
              <Drawer.Handle className="h-1 w-10 rounded-full bg-zinc-300" />
            </div>
          ) : null}

          {/* Sticky header */}
          <div
            className={`shrink-0 border-b border-zinc-100 px-5 pb-4 ${
              isRight ? "pt-6" : "pt-4"
            }`}
          >
            <Drawer.Title id={titleId} className="text-lg font-semibold text-zinc-900">
              {title}
            </Drawer.Title>
            {subtitle ? <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p> : null}
            {description ? (
              <Drawer.Description id={descId} className="mt-1 text-sm text-zinc-600">
                {description}
              </Drawer.Description>
            ) : (
              // Satisfy Radix when no visible description is provided.
              <Drawer.Description className="sr-only">{title}</Drawer.Description>
            )}
          </div>

          {/* Scrollable form body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-5">
            {children}

            {dangerZone ? (
              <div className="mt-8 border-t-2 border-dashed border-red-200 pt-5">{dangerZone}</div>
            ) : null}
          </div>

          {/* Sticky footer */}
          <div className={`shrink-0 border-t border-zinc-100 px-5 pt-4 ${isRight ? "pb-8" : "pb-6"}`}>
            {footer}
          </div>

          {/* Nested confirm / overlays — must stay inside Content */}
          {overlay}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
