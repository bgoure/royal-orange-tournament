"use client";

import { useActionState } from "react";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import { updatePublicAnnouncementsVisibility } from "@/app/admin/_actions/tournament-basics";

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

export function TournamentPublicAnnouncementsForm({
  showPublicAnnouncements,
  tournamentName,
  canManage,
}: {
  showPublicAnnouncements: boolean;
  tournamentName: string;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(
    updatePublicAnnouncementsVisibility,
    undefined as ContentActionResult | undefined,
  );

  if (!canManage) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Public announcements</h2>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to change this setting.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
      <h2 className="text-sm font-semibold text-zinc-900">Public announcements</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Controls the announcements block on the tournament home page, the Announcements link in <strong>More</strong>,
        and the full history page for <strong>{tournamentName}</strong>. Admin announcements tools are unchanged.
      </p>
      <ErrorBanner state={state} />
      <SuccessBanner state={state} />
      <form action={action} className="mt-4 flex max-w-xl flex-col gap-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-800">
          <input
            type="checkbox"
            name="showPublicAnnouncements"
            defaultChecked={showPublicAnnouncements}
            className="mt-1 rounded border-zinc-300"
          />
          <span>
            <span className={labelClass}>Show on public site</span>
            <span className="mt-0.5 block text-sm font-normal text-zinc-700">
              Uncheck to hide all public announcement UI (home section, More menu entry, and /announcements page).
            </span>
          </span>
        </label>
        <button type="submit" disabled={pending} className={`${btnPrimary} w-fit`}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </section>
  );
}
