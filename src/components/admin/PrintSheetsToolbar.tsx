"use client";

export function PrintSheetsToolbar({ gameCount }: { gameCount: number }) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6 print:hidden">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Game results sheets</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {gameCount} game{gameCount === 1 ? "" : "s"} — two sheets per printed page (landscape).
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-royal px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-royal-800"
      >
        Print
      </button>
    </div>
  );
}
