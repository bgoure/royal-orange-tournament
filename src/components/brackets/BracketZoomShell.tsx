"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";

const MIN_PCT = 50;
const MAX_PCT = 200;
const STEP_PCT = 15;

function touchDistance(touches: TouchList | ReactTouchEvent["touches"]): number {
  if (touches.length < 2) return 0;
  const a = touches[0]!;
  const b = touches[1]!;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function notifyZoomChange() {
  window.dispatchEvent(new Event("bracket-zoom-change"));
}

/**
 * Zoom + pan shell for bracket trees.
 * - Mobile: pinch to zoom (no buttons)
 * - Desktop (md+): +/- zoom controls
 */
export function BracketZoomShell({ children }: { children: ReactNode }) {
  const [scalePct, setScalePct] = useState(100);
  const scale = scalePct / 100;
  const pinchRef = useRef<{ startDist: number; startPct: number } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scalePctRef = useRef(scalePct);
  scalePctRef.current = scalePct;

  const clampPct = useCallback((n: number) => Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round(n))), []);

  const setScale = useCallback(
    (next: number | ((prev: number) => number)) => {
      setScalePct((prev) => {
        const raw = typeof next === "function" ? next(prev) : next;
        return clampPct(raw);
      });
    },
    [clampPct],
  );

  useEffect(() => {
    // Let connector SVG remeasure after transform settles.
    const id = requestAnimationFrame(() => notifyZoomChange());
    return () => cancelAnimationFrame(id);
  }, [scalePct]);

  const onTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        startDist: touchDistance(e.touches),
        startPct: scalePctRef.current,
      };
    }
  };

  const onTouchEnd = (e: ReactTouchEvent) => {
    if (e.touches.length < 2) {
      pinchRef.current = null;
      notifyZoomChange();
    }
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      const dist = touchDistance(e.touches);
      if (pinchRef.current.startDist < 8) return;
      e.preventDefault();
      const next = pinchRef.current.startPct * (dist / pinchRef.current.startDist);
      setScale(next);
    };
    el.addEventListener("touchmove", move, { passive: false });
    return () => el.removeEventListener("touchmove", move);
  }, [setScale]);

  return (
    <div className="relative" {...{ [DIVISION_SWIPE_IGNORE]: "" }}>
      <div className="mb-2 hidden items-center justify-end gap-1 md:flex">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Zoom
        </span>
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-lg font-semibold text-zinc-800 shadow-sm disabled:opacity-40"
          aria-label="Zoom out"
          disabled={scalePct <= MIN_PCT}
          onClick={() => setScale((p) => p - STEP_PCT)}
        >
          −
        </button>
        <button
          type="button"
          className="min-w-14 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-semibold tabular-nums text-zinc-800 shadow-sm"
          aria-label="Reset zoom"
          onClick={() => setScale(100)}
        >
          {scalePct}%
        </button>
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-lg font-semibold text-zinc-800 shadow-sm disabled:opacity-40"
          aria-label="Zoom in"
          disabled={scalePct >= MAX_PCT}
          onClick={() => setScale((p) => p + STEP_PCT)}
        >
          +
        </button>
      </div>
      <div
        ref={scrollerRef}
        className="overflow-x-auto overflow-y-auto pb-2"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className="origin-top-left will-change-transform"
          style={{
            transform: `scale(${scale})`,
            width: scale !== 1 ? `${100 / scale}%` : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
