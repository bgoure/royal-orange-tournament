"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { focusWindowRange, isIndexInFocusWindow } from "@/lib/brackets/bracket-round-window";
import { readRoundFocusPrefs, writeRoundFocusPrefs } from "@/lib/brackets/bracket-viewer-prefs";

export function useRoundFocus(
  columnCount: number,
  activeIndex: number,
  expandAll: boolean,
  persistKey?: string,
) {
  const { lo, hi } = useMemo(
    () => focusWindowRange(activeIndex, columnCount),
    [activeIndex, columnCount],
  );
  const [forcedCollapsed, setForcedCollapsed] = useState<Set<number>>(() => new Set());
  const [extraOpen, setExtraOpen] = useState<Set<number>>(() => new Set());
  const [ready, setReady] = useState(!persistKey);

  useEffect(() => {
    if (!persistKey || expandAll) {
      setReady(true);
      return;
    }
    const saved = readRoundFocusPrefs(persistKey);
    if (saved) {
      setForcedCollapsed(new Set(saved.forcedCollapsed));
      setExtraOpen(new Set(saved.extraOpen));
    }
    setReady(true);
  }, [persistKey, expandAll]);

  useEffect(() => {
    if (!ready || !persistKey || expandAll) return;
    writeRoundFocusPrefs(persistKey, {
      extraOpen: [...extraOpen],
      forcedCollapsed: [...forcedCollapsed],
    });
  }, [ready, persistKey, expandAll, extraOpen, forcedCollapsed]);

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
