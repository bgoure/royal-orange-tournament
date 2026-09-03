"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Something broke</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">
          This page didn’t load
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Scores, schedules, and brackets are still safe — this was a display problem. Try again, and
          if it keeps happening let a tournament director know.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs text-zinc-400">
            Reference <code className="rounded bg-zinc-100 px-1 py-0.5">{error.digest}</code>
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
