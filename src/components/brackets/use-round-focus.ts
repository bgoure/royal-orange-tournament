"use client";

import { useCallback, useMemo, useState } from "react";
import { focusWindowRange, isIndexInFocusWindow } from "@/lib/brackets/bracket-round-window";

export function useRoundFocus(columnCount: number, activeIndex: number, expandAll: boolean) {
  const { lo, hi } = useMemo(
    () => focusWindowRange(activeIndex, columnCount),
    [activeIndex, columnCount],
  );
  const [forcedCollapsed, setForcedCollapsed] = useState<Set<number>>(() => new Set());
  const [extraOpen, setExtraOpen] = useState<Set<number>>(() => new Set());

  const isOpen = useCallback(
    (index: number) => {
      if (expandAll) return true;
      if (forcedCollapsed.has(index)) return false;
      if (isIndexInFocusWindow(index, lo, hi)) return true;
      return extraOpen.has(index);
    },
    [expandAll, extraOpen, forcedCollapsed, hi, lo],
  );

  const toggle = useCallback(
    (index: number) => {
      if (expandAll) return;
      if (isOpen(index)) {
        if (isIndexInFocusWindow(index, lo, hi)) {
          setForcedCollapsed((prev) => new Set(prev).add(index));
        } else {
          setExtraOpen((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        }
        return;
      }
      setForcedCollapsed((prev) => {
        if (!prev.has(index)) return prev;
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      setExtraOpen((prev) => new Set(prev).add(index));
    },
    [expandAll, isOpen, hi, lo],
  );

  const rangeOverlaps = useCallback(
    (from: number, to: number) => {
      if (expandAll) return true;
      for (let i = from; i <= to; i++) {
        if (isOpen(i)) return true;
      }
      return false;
    },
    [expandAll, isOpen],
  );

  return { lo, hi, isOpen, toggle, rangeOverlaps };
}
