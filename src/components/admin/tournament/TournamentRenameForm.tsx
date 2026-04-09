"use client";

import { useActionState } from "react";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import { updateTournamentName } from "@/app/admin/_actions/tournament-basics";

const formClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";

function ErrorBanner({ state }: { state: ContentActionResult | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">
      {state.error}
    </p>
  );
}

function SuccessBanner({ state }: { state: ContentActionResult | undefined }) {
  if (!state || !state.ok || !state.notice) return null;
  return (
    <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
      {state.notice}
    </p>
  );
}

export function TournamentRenameForm({
  tournamentName,
  canManage,
}: {
  tournamentName: string;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateTournamentName,
    undefined as ContentActionResult | undefined,
  );

  if (!canManage) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Tournament name</h2>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to rename this tournament.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
      <h2 className="text-sm font-semibold text-zinc-900">Tournament name</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Public name in headers, switcher, and most pages. The site URL slug is unchanged.
      </p>
      <ErrorBanner state={state} />
      <SuccessBanner state={state} />
      <form action={action} className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="tournament-name" className={labelClass}>
            Name
          </label>
          <input
            id="tournament-name"
            name="name"
            type="text"
            required
            maxLength={200}
            defaultValue={tournamentName}
            className={`${formClass} mt-1 w-full`}
          />
        </div>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : "Save name"}
        </button>
      </form>
    </section>
  );
}
