"use client";

import { useCallback, useId, useMemo, useSyncExternalStore } from "react";
import { focusWindowRange, isIndexInFocusWindow } from "@/lib/brackets/bracket-round-window";
import {
  readRoundFocusPrefs,
  writeRoundFocusPrefs,
  type StoredRoundFocus,
} from "@/lib/brackets/bracket-viewer-prefs";

const EMPTY_FOCUS: StoredRoundFocus = { extraOpen: [], forcedCollapsed: [] };

// The rounds cookie is an external store keyed by persist key, so the first client
// render already reflects the saved columns instead of flipping them open afterwards.
// Unpersisted callers get an ephemeral key and stay in memory.
const focusSnapshots = new Map<string, StoredRoundFocus>();
const focusListeners = new Map<string, Set<() => void>>();

function subscribeToFocus(key: string, listener: () => void) {
  let listeners = focusListeners.get(key);
  if (!listeners) {
    listeners = new Set();
    focusListeners.set(key, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getFocusSnapshot(key: string, persist: boolean): StoredRoundFocus {
  const cached = focusSnapshots.get(key);
  if (cached) return cached;
  const next = (persist ? readRoundFocusPrefs(key) : null) ?? EMPTY_FOCUS;
  focusSnapshots.set(key, next);
  return next;
}

function getFocusServerSnapshot(): StoredRoundFocus {
  return EMPTY_FOCUS;
}

function publishFocus(key: string, next: StoredRoundFocus, persist: boolean) {
  focusSnapshots.set(key, next);
  if (persist) writeRoundFocusPrefs(key, next);
  const listeners = focusListeners.get(key);
  if (listeners) for (const listener of [...listeners]) listener();
}

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

  const ephemeralKey = useId();
  const persist = !!persistKey && !expandAll;
  const key = persist ? persistKey! : ephemeralKey;

  const subscribe = useCallback(
    (listener: () => void) => subscribeToFocus(key, listener),
    [key],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    useCallback(() => getFocusSnapshot(key, persist), [key, persist]),
    getFocusServerSnapshot,
  );

  const forcedCollapsed = useMemo(() => new Set(snapshot.forcedCollapsed), [snapshot]);
  const extraOpen = useMemo(() => new Set(snapshot.extraOpen), [snapshot]);

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
      const nextCollapsed = new Set(forcedCollapsed);
      const nextExtraOpen = new Set(extraOpen);
      if (isOpen(index)) {
        if (isIndexInFocusWindow(index, lo, hi)) nextCollapsed.add(index);
        else nextExtraOpen.delete(index);
      } else {
        nextCollapsed.delete(index);
        nextExtraOpen.add(index);
      }
      publishFocus(
        key,
        { extraOpen: [...nextExtraOpen], forcedCollapsed: [...nextCollapsed] },
        persist,
      );
    },
    [expandAll, extraOpen, forcedCollapsed, hi, isOpen, key, lo, persist],
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
