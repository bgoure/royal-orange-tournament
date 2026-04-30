"use client";

import { useActionState } from "react";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import { updateTournamentPublicSwitcherOrder } from "@/app/admin/_actions/tournament-basics";

const inputClass =
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

export function TournamentPublicSwitcherOrderForm({
  publicSwitcherOrder,
  canManage,
  tournamentSlug,
}: {
  publicSwitcherOrder: number;
  canManage: boolean;
  tournamentSlug: string;
}) {
  const [state, action, pending] = useActionState(
    updateTournamentPublicSwitcherOrder,
    undefined as ContentActionResult | undefined,
  );

  if (!canManage) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Public site default</h2>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to change switcher order.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
      <h2 className="text-sm font-semibold text-zinc-900">Public site default &amp; switcher</h2>
      <p className="mt-1 text-xs text-zinc-600">
        <strong>Lower numbers appear first</strong> in the tournament picker and win when someone opens the site
        root URL (<span className="font-mono text-zinc-800">/</span>) without a saved tournament. Same-day ties use
        earliest start date, then slug. Direct links such as{" "}
        <span className="font-mono text-zinc-800">/{tournamentSlug}</span> always work.
      </p>
      <ErrorBanner state={state} />
      <SuccessBanner state={state} />
      <form action={action} className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="public-switcher-order" className={labelClass}>
            Switcher order
          </label>
          <input
            id="public-switcher-order"
            name="publicSwitcherOrder"
            type="number"
            required
            min={0}
            max={999_999}
            step={1}
            defaultValue={publicSwitcherOrder}
            className={`${inputClass} mt-1 w-full sm:max-w-[12rem]`}
          />
        </div>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : "Save order"}
        </button>
      </form>
    </section>
  );
}
