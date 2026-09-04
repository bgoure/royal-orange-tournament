"use client";

import type { ReactNode } from "react";

type Props = {
  /** Accessible name for the menu trigger (e.g. “Reorder Riverside Park”). */
  label: string;
  error?: string;
  children: ReactNode;
};

/**
 * Secondary actions (Move up / Move down) tucked behind a single control so
 * summary rows keep one primary Edit button.
 */
export function ReorderMenu({ label, error, children }: Props) {
  return (
    <details className="relative">
      <summary
        className="inline-flex h-10 cursor-pointer list-none items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden"
        aria-label={label}
      >
        Reorder
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-[9rem] rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
        {children}
      </div>
      {error ? (
        <p role="alert" className="absolute right-0 top-full z-20 mt-10 w-48 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </details>
  );
}
