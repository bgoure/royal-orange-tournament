import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">
          We couldn’t find that page
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          The link may be out of date, or the tournament may have been archived or unpublished.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Browse tournaments
          </Link>
        </div>
      </div>
    </main>
  );
}
