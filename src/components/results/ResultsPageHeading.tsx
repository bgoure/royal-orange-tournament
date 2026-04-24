"use client";

import { useRef } from "react";
import { PageTitle } from "@/components/ui/PublicHeading";

const GLOSSARY_ITEMS: { abbr: string; text: string }[] = [
  { abbr: "W", text: "Wins" },
  { abbr: "L", text: "Losses" },
  { abbr: "T", text: "Ties" },
  {
    abbr: "PTS",
    text: "Points accumulated (2 for a Win, 1 for a Tie, 0 for a Loss)",
  },
  { abbr: "RS", text: "Runs Scored" },
  { abbr: "RA", text: "Runs Allowed" },
  { abbr: "DI", text: "Defensive Innings Completed" },
  {
    abbr: "RA/DI",
    text: "Ratio of Runs Allowed per Defensive Inning (used for tiebreaker if required).",
  },
];

export function ResultsPageHeading() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <div className="flex flex-wrap items-end gap-2">
      <PageTitle className="min-w-0 flex-1">Results</PageTitle>
      <button
        type="button"
        onClick={open}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 text-xs font-semibold italic leading-none text-zinc-600 shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
        aria-label="Standings glossary"
        aria-haspopup="dialog"
      >
        i
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="standings-glossary-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="fixed left-1/2 top-1/2 z-[100] m-0 max-h-[min(90dvh,100%)] w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/50 bg-white/92 p-0 text-zinc-900 shadow-xl backdrop-blur-xl dark:border-zinc-600/50 dark:bg-zinc-900/90 [&::backdrop]:bg-zinc-900/40"
      >
        <div className="p-5">
          <h2 id="standings-glossary-title" className="text-base font-semibold text-zinc-900">
            Standings Glossary:
          </h2>
          <dl className="mt-4 space-y-3 text-sm leading-snug">
            {GLOSSARY_ITEMS.map(({ abbr, text }) => (
              <div key={abbr} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                <dt className="font-mono font-bold tabular-nums text-zinc-900">{abbr}</dt>
                <dd className="min-w-0 text-zinc-600">— {text}</dd>
              </div>
            ))}
          </dl>
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
