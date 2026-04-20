"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";

const THRESHOLD_PX = 72;
/** Height of the indicator strip while `router.refresh` transition is in flight */
const PENDING_INDICATOR_PX = 48;

/**
 * Pull down at scroll top to refetch server components (`router.refresh`).
 * iOS-friendly: no extra deps; complements native overscroll where present.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (typeof window === "undefined" || window.scrollY > 8) return;
    startY.current = e.touches[0].clientY;
    active.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!active.current || startY.current == null || window.scrollY > 8) return;
    const y = e.touches[0].clientY;
    const d = y - startY.current;
    if (d > 0) {
      const p = Math.min(d * 0.5, 96);
      pullRef.current = p;
      setPull(p);
    }
  }, []);

  const end = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    startY.current = null;
    const p = pullRef.current;
    pullRef.current = 0;
    if (p >= THRESHOLD_PX) {
      setPull(0);
      startTransition(() => {
        router.refresh();
      });
    } else {
      setPull(0);
    }
  }, [router]);

  const onTouchEnd = useCallback(() => end(), [end]);
  const onTouchCancel = useCallback(() => end(), [end]);

  const indicatorHeight = pending ? PENDING_INDICATOR_PX : pull;
  const showLabel = pending || pull > 8;

  return (
    <div
      className="relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <div
        className="pointer-events-none flex items-end justify-center overflow-hidden text-royal transition-[height] duration-150"
        style={{ height: indicatorHeight > 4 ? indicatorHeight : 0 }}
        aria-hidden
      >
        {showLabel ? (
          <span className="flex items-center gap-2 pb-1 text-xs font-medium">
            {pending ? (
              <>
                <span
                  className="inline-block size-4 shrink-0 rounded-full border-2 border-royal/30 border-t-royal animate-spin"
                  aria-hidden
                />
                Refreshing…
              </>
            ) : pull >= THRESHOLD_PX ? (
              "Release to refresh"
            ) : (
              "Pull to refresh"
            )}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
