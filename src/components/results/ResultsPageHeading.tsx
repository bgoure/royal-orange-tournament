"use client";

import { useRef } from "react";
import { PageTitle } from "@/components/ui/PublicHeading";

const RESULTS_INFO =
  "Pool standings and completed games. Points: 2 win, 1 tie, 0 loss. Tiebreakers follow published pool rules.";

export function ResultsPageHeading() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <div className="flex flex-wrap items-end gap-2">
      <PageTitle className="flex-1 min-w-0">Results</PageTitle>
      <button
        type="button"
        onClick={open}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 text-xs font-semibold italic leading-none text-zinc-600 shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
        aria-label="About results and standings"
        aria-haspopup="dialog"
      >
        i
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="results-info-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="fixed left-1/2 top-1/2 z-[100] m-0 max-h-[min(90dvh,100%)] w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl [&::backdrop]:bg-zinc-900/40"
      >
        <div className="p-5">
          <h2 id="results-info-title" className="text-base font-semibold text-zinc-900">
            About this page
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">{RESULTS_INFO}</p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50"
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
