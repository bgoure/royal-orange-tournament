"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";

const MIN_PCT = 50;
const MAX_PCT = 200;
const STEP_PCT = 15;
const TAP_MOVE_PX = 14;

/** Desktop: 50% wider than the site column, capped to the viewport. */
export const BRACKET_DESKTOP_WIDE_CLASS =
  "md:w-[min(150%,calc(100vw-2rem))] md:ml-[calc((100%-min(150%,calc(100vw-2rem)))/2)] md:mr-[calc((100%-min(150%,calc(100vw-2rem)))/2)]";

function touchDistance(touches: TouchList | ReactTouchEvent["touches"]): number {
  if (touches.length < 2) return 0;
  const a = touches[0]!;
  const b = touches[1]!;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function notifyZoomChange() {
  window.dispatchEvent(new Event("bracket-zoom-change"));
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest("button, a, input, select, textarea, label");
}

/**
 * Zoom + pan shell for bracket trees.
 * - Mobile: pinch to zoom (no buttons); optional photo-style fullscreen
 * - Desktop (md+): +/- zoom controls
 */
export function BracketZoomShell({
  children,
  toolbarStart,
}: {
  children: ReactNode;
  /** Left side of the toolbar (e.g. download). Zoom stays on the right on desktop. */
  toolbarStart?: ReactNode;
}) {
  const [scalePct, setScalePct] = useState(100);
  const scale = scalePct / 100;
  const pinchRef = useRef<{ startDist: number; startPct: number } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scalePctRef = useRef(scalePct);
  scalePctRef.current = scalePct;
  const [immersive, setImmersive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tapRef = useRef<{ x: number; y: number; pinching: boolean } | null>(null);

  useEffect(() => setMounted(true), []);

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
    const id = requestAnimationFrame(() => notifyZoomChange());
    return () => cancelAnimationFrame(id);
  }, [scalePct]);

  const enterFullscreen = useCallback(async (el: HTMLElement | null) => {
    if (!el) return;
    const req =
      el.requestFullscreen?.bind(el) ??
      (
        el as HTMLElement & {
          webkitRequestFullscreen?: (opts?: FullscreenOptions) => Promise<void>;
        }
      ).webkitRequestFullscreen?.bind(el);
    if (!req) return;
    try {
      await req({ navigationUI: "hide" });
    } catch {
      try {
        await req();
      } catch {
        /* iOS / embedded browsers may reject fullscreen */
      }
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
    if (!document.fullscreenElement && !doc.webkitExitFullscreen) return;
    try {
      await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!immersive) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => {
      void enterFullscreen(overlayRef.current);
      notifyZoomChange();
    });
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prevOverflow;
      void exitFullscreen();
    };
  }, [immersive, enterFullscreen, exitFullscreen]);

  const onTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        startDist: touchDistance(e.touches),
        startPct: scalePctRef.current,
      };
      if (tapRef.current) tapRef.current.pinching = true;
    } else if (e.touches.length === 1 && immersive) {
      tapRef.current = {
        x: e.touches[0]!.clientX,
        y: e.touches[0]!.clientY,
        pinching: false,
      };
    }
  };

  const onTouchEnd = (e: ReactTouchEvent) => {
    if (e.touches.length < 2) {
      pinchRef.current = null;
      notifyZoomChange();
    }
    if (!immersive || e.touches.length > 0) return;
    const tap = tapRef.current;
    tapRef.current = null;
    if (!tap || tap.pinching) return;
    if (isInteractiveTarget(e.target)) return;
    const t = e.changedTouches[0];
    if (!t) return;
    if (Math.hypot(t.clientX - tap.x, t.clientY - tap.y) > TAP_MOVE_PX) return;
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    if (document.fullscreenElement || doc.webkitFullscreenElement) void exitFullscreen();
    else void enterFullscreen(overlayRef.current);
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
  }, [setScale, immersive]);

  const scroller = (
    <div
      ref={scrollerRef}
      className={
        immersive
          ? "h-full overflow-auto pb-2"
          : "overflow-x-auto overflow-y-auto pb-2"
      }
      style={{
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-x pan-y",
        height: immersive ? "100%" : undefined,
      }}
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
  );

  const toolbar = (
    <div
      className={`mb-2 items-center gap-2 ${
        toolbarStart ? "flex justify-between" : "flex justify-end md:flex"
      } ${immersive ? "px-3 pt-3" : ""}`}
    >
      <div className="min-w-0">{toolbarStart}</div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="inline-flex min-h-9 items-center rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm md:hidden"
          onClick={() => (immersive ? setImmersive(false) : setImmersive(true))}
        >
          {immersive ? "Close" : "View as photo"}
        </button>
        <div className={`items-center gap-1 ${immersive ? "flex" : "hidden md:flex"}`}>
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
      </div>
    </div>
  );

  const overlay =
    immersive && mounted
      ? createPortal(
          <div
            ref={overlayRef}
            className="fixed inset-0 z-[300] flex flex-col bg-white"
            style={{ height: "100dvh" }}
            role="dialog"
            aria-label="Bracket photo view"
          >
            {toolbar}
            <p className="px-3 pb-1 text-[11px] text-zinc-500">
              Pinch to zoom. Tap empty space to hide or show the address bar.
            </p>
            <div className="min-h-0 flex-1 px-2">{scroller}</div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative" {...{ [DIVISION_SWIPE_IGNORE]: "" }}>
      {!immersive ? (
        <>
          {toolbar}
          {scroller}
        </>
      ) : null}
      {overlay}
    </div>
  );
}
