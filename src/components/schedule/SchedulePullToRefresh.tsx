"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";

const THRESHOLD_PX = 72;

/**
 * Pull down at scroll top to refetch server components (router.refresh).
 * iOS-friendly: no extra deps; complements native overscroll where present.
 */
export function SchedulePullToRefresh({ children }: { children: ReactNode }) {
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
      startTransition(() => {
        router.refresh();
      });
    }
    setPull(0);
  }, [router]);

  const onTouchEnd = useCallback(() => end(), [end]);
  const onTouchCancel = useCallback(() => end(), [end]);

  return (
    <div className="relative" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel}>
      <div
        className="pointer-events-none flex items-end justify-center overflow-hidden text-royal transition-[height] duration-150"
        style={{ height: pull > 4 ? pull : 0 }}
        aria-hidden
      >
        {pull > 8 ? (
          <span className="pb-1 text-xs font-medium">
            {pending ? "Refreshing…" : pull >= THRESHOLD_PX ? "Release to refresh" : "Pull to refresh"}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
