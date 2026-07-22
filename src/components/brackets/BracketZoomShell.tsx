"use client";

import { useState, type ReactNode } from "react";

/**
 * Mobile-friendly zoom + pan shell for bracket trees.
 * Desktop (md+) renders children unchanged.
 */
export function BracketZoomShell({ children }: { children: ReactNode }) {
  const [scalePct, setScalePct] = useState(100);
  const scale = scalePct / 100;

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-end gap-1 md:hidden">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Zoom
        </span>
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-lg font-semibold text-zinc-800 shadow-sm disabled:opacity-40"
          aria-label="Zoom out"
          disabled={scalePct <= 60}
          onClick={() => setScalePct((p) => Math.max(60, p - 15))}
        >
          −
        </button>
        <button
          type="button"
          className="min-w-14 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-semibold tabular-nums text-zinc-800 shadow-sm"
          aria-label="Reset zoom"
          onClick={() => setScalePct(100)}
        >
          {scalePct}%
        </button>
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-lg font-semibold text-zinc-800 shadow-sm disabled:opacity-40"
          aria-label="Zoom in"
          disabled={scalePct >= 150}
          onClick={() => setScalePct((p) => Math.min(150, p + 15))}
        >
          +
        </button>
      </div>
      <div
        className="overflow-x-auto overflow-y-auto touch-pan-x touch-pan-y pb-2 md:overflow-visible"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          className="origin-top-left transition-transform duration-150 md:!scale-100"
          style={{ transform: `scale(${scale})`, width: scale !== 1 ? `${100 / scale}%` : undefined }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
