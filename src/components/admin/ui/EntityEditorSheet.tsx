"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { Drawer } from "vaul";

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
   * Called when the user attempts to close the sheet (Escape, backdrop click,
   * or a Cancel button inside `footer`).  If you want to guard against unsaved
   * changes, return false here.  The default (undefined) always closes.
   */
  onCloseAttempt?: () => boolean;
};

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible editor panel built on vaul Drawer.
 *
 * Responsive layout:
 *   – Phone (< sm):  full-screen bottom sheet, consistent with InviteUserSheet
 *   – sm – lg:       tall bottom sheet (90 vh), list stays behind on landscape
 *   – lg+:           right-side drawer (max-w-lg), list remains scrollable
 *
 * Accessibility contract:
 *   – role="dialog" aria-modal aria-labelledby aria-describedby
 *   – Focus enters the panel on open; focus trap via Tab/Shift-Tab
 *   – Escape closes (via onOpenChange), guarded by onCloseAttempt
 *   – Focus returns to the opener on close (Drawer handles this via portal)
 *   – Background scroll locked while open
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
  onCloseAttempt,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open (vaul handles this on mobile; belt-and-suspenders for desktop).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus the first focusable element when the panel opens.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 50); // small delay lets the CSS transition settle
    return () => window.clearTimeout(id);
  }, [open]);

  // Trap focus inside the panel and handle Escape.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        const allowed = onCloseAttempt ? onCloseAttempt() : true;
        if (allowed) onOpenChange(false);
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onOpenChange, onCloseAttempt]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && onCloseAttempt) {
        const allowed = onCloseAttempt();
        if (!allowed) return;
      }
      onOpenChange(next);
    },
    [onOpenChange, onCloseAttempt],
  );

  return (
    <Drawer.Root open={open} onOpenChange={handleOpenChange} direction="bottom">
      <Drawer.Portal>
        {/* Backdrop */}
        <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/40" />

        {/*
         * On large screens this acts as a right-side panel via CSS positioning.
         * On small screens vaul's default bottom-sheet behaviour takes over.
         */}
        <Drawer.Content
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          className={[
            // Mobile: bottom sheet
            "fixed bottom-0 left-0 right-0 z-[80]",
            "flex max-h-[92vh] flex-col rounded-t-2xl bg-white outline-none",
            // Desktop: right-side drawer overlay
            "lg:bottom-0 lg:left-auto lg:right-0 lg:top-0 lg:max-h-full lg:w-full lg:max-w-lg lg:rounded-none lg:rounded-l-2xl lg:shadow-2xl",
          ].join(" ")}
        >
          {/* Drag handle — hidden on desktop */}
          <div className="flex shrink-0 justify-center pt-3 lg:hidden" aria-hidden>
            <Drawer.Handle className="h-1 w-10 rounded-full bg-zinc-300" />
          </div>

          {/* Sticky header */}
          <div className="shrink-0 border-b border-zinc-100 px-5 pb-4 pt-4 lg:pt-6">
            <Drawer.Title id={titleId} className="text-lg font-semibold text-zinc-900">
              {title}
            </Drawer.Title>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
            ) : null}
            {description ? (
              <p id={descId} className="mt-1 text-sm text-zinc-600">
                {description}
              </p>
            ) : null}
          </div>

          {/* Scrollable form body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-5">
            {children}

            {/* Danger zone — visually separated */}
            {dangerZone ? (
              <div className="mt-8 border-t-2 border-dashed border-red-200 pt-5">
                {dangerZone}
              </div>
            ) : null}
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-zinc-100 px-5 pb-6 pt-4 lg:pb-8">
            {footer}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
