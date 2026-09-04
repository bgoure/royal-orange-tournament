"use client";

import { useCallback, useEffect, useState } from "react";
import {
  discardEditsConfirmDescription,
  discardEditsConfirmTitle,
  editorUnsavedLabel,
  shouldBlockSheetClose,
} from "@/components/admin/ui/editor-form-ux";

type Options = {
  open: boolean;
  onClose: () => void;
  /** True when the primary save action returned ok. */
  savedOk?: boolean;
  /** True while a nested danger confirm (or similar) is open. */
  nestedBusy?: boolean;
  /** Delay before closing after a successful save (ms). */
  successCloseDelayMs?: number;
};

/**
 * Dirty tracking, discard confirm, delayed close-after-save for EntityEditorSheet forms.
 * Remount the sheet (`key={session}`) so dirty starts clean on each open.
 */
export function useEditorFormUx({
  open,
  onClose,
  savedOk = false,
  nestedBusy = false,
  successCloseDelayMs = 650,
}: Options) {
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const markDirty = useCallback(() => {
    if (!savedOk) setDirty(true);
  }, [savedOk]);

  useEffect(() => {
    if (!open || !savedOk) return;
    const t = window.setTimeout(() => onClose(), successCloseDelayMs);
    return () => window.clearTimeout(t);
  }, [open, savedOk, onClose, successCloseDelayMs]);

  const attemptClose = useCallback((): boolean => {
    if (nestedBusy || discardOpen) return false;
    if (shouldBlockSheetClose(dirty, savedOk)) {
      setDiscardOpen(true);
      return false;
    }
    onClose();
    return true;
  }, [nestedBusy, discardOpen, dirty, savedOk, onClose]);

  const cancelDiscard = useCallback(() => {
    if (!nestedBusy) setDiscardOpen(false);
  }, [nestedBusy]);

  const confirmDiscard = useCallback(() => {
    setDiscardOpen(false);
    setDirty(false);
    onClose();
  }, [onClose]);

  return {
    dirty: dirty && !savedOk,
    unsavedLabel: editorUnsavedLabel(),
    discardOpen: discardOpen && open,
    discardTitle: discardEditsConfirmTitle(),
    discardDescription: discardEditsConfirmDescription(),
    markDirty,
    /** Spread onto the form element to mark dirty on user input. */
    formDirtyProps: {
      onInput: markDirty,
      onChange: markDirty,
    },
    dismissible: !nestedBusy && !discardOpen,
    onCloseAttempt: attemptClose,
    cancelDiscard,
    confirmDiscard,
    justSaved: Boolean(open && savedOk),
  };
}
