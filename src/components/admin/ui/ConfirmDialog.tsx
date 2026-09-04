"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  /** Explains the consequence of confirming; announced with the dialog. */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** Disables the confirm button while a server action is in flight. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional extra content (e.g. a "type the name to confirm" input). */
  children?: ReactNode;
  /**
   * When true, render as an absolute overlay inside a positioned ancestor
   * (e.g. EntityEditorSheet / Drawer.Content) instead of a viewport-fixed
   * portal sibling. Required when nesting under a Radix modal dialog, which
   * disables pointer events outside its content node.
   */
  contained?: boolean;
};

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal confirmation with a full keyboard contract: Escape closes, Tab cycles
 * inside the panel, focus starts on the safest control, and the previously
 * focused element is restored on close.
 *
 * Nest under EntityEditorSheet via `contained` + the sheet's `overlay` slot so
 * the confirm stays inside the Radix modal content tree and remains interactive.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
  children,
  contained = false,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const handleCancel = useCallback(() => {
    if (busy) return;
    onCancel();
  }, [busy, onCancel]);

  const handleConfirm = useCallback(() => {
    if (busy) return;
    onConfirm();
  }, [busy, onConfirm]);

  // Capture the opener when opening; restore focus when closing.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    return () => {
      openerRef.current?.focus?.();
      openerRef.current = null;
    };
  }, [open]);

  // Destructive actions start on Cancel so Enter never nukes anything.
  useEffect(() => {
    if (!open) return;
    const initial = tone === "danger" ? cancelRef.current : confirmRef.current;
    (initial ?? panelRef.current)?.focus();
  }, [open, tone]);

  // Only lock body scroll for viewport-level confirms; contained ones sit inside
  // a parent that already manages scroll lock.
  useEffect(() => {
    if (!open || contained) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, contained]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Stop Vaul/Radix on the parent editor from also handling Escape.
        event.stopPropagation();
        event.preventDefault();
        handleCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, handleCancel]);

  if (!open) return null;

  return (
    <div
      className={
        contained
          ? "absolute inset-0 z-20 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          : "fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      }
      data-confirm-contained={contained ? "true" : "false"}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={`Close ${title}`}
        tabIndex={-1}
        onClick={handleCancel}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl outline-none"
      >
        <h2 id={titleId} className="text-base font-semibold text-zinc-900">
          {title}
        </h2>
        {description ? (
          <div id={descriptionId} className="mt-1 text-sm text-zinc-600">
            {description}
          </div>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={
              tone === "danger"
                ? "rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                : "rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            }
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
