"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import {
  hardDeleteTournament,
  softResetTournamentProgress,
} from "@/app/admin/_actions/tournament-reset";

const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnDanger =
  "rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50";
const btnDestroy =
  "rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50";

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

export function TournamentDangerZoneForm({
  tournamentSlug,
  tournamentName,
  canManage,
  isAdmin,
}: {
  tournamentSlug: string;
  tournamentName: string;
  canManage: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [softState, softAction, softPending] = useActionState(
    softResetTournamentProgress,
    undefined as ContentActionResult | undefined,
  );
  const [hardState, hardAction, hardPending] = useActionState(
    hardDeleteTournament,
    undefined as ContentActionResult | undefined,
  );

  useEffect(() => {
    if (hardState?.ok) {
      router.refresh();
    }
  }, [hardState, router]);

  if (!canManage) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Danger zone</h2>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to reset or delete this tournament.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-red-200 bg-red-50/40 p-6">
      <h2 className="text-sm font-semibold text-red-950">Danger zone</h2>
      <p className="mt-1 text-xs text-red-900/80">
        Irreversible actions for <strong>{tournamentName}</strong> ({tournamentSlug}).
      </p>

      <div className="mt-6 space-y-8">
        <div>
          <h3 className="text-xs font-semibold text-zinc-900">Soft reset — scores and bracket progression</h3>
          <p className="mt-1 text-sm text-zinc-700">
            Clears runs and inning lines, sets games to scheduled (except cancelled and postponed). Postponed games
            keep their status but lose scores. Pool standings recompute to zeros; bracket rounds after the first are
            cleared, then round one and consolation games are refilled from current pool order. Divisions, teams,
            schedules, sponsors, announcements, FAQ, and email subscribers are unchanged.
          </p>
          <ErrorBanner state={softState} />
          <SuccessBanner state={softState} />
          <form action={softAction} className="mt-4 flex max-w-xl flex-col gap-3">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-800">
              <input type="checkbox" name="confirmSoftReset" className="mt-1 rounded border-zinc-300" />
              <span>
                <span className={labelClass}>Confirm soft reset</span>
                <span className="mt-0.5 block text-sm font-normal text-zinc-700">
                  I want to clear scores and bracket advancement while keeping this event and its content.
                </span>
              </span>
            </label>
            <button type="submit" disabled={softPending} className={`${btnDanger} w-fit`}>
              {softPending ? "Resetting…" : "Soft reset tournament progress"}
            </button>
          </form>
        </div>

        {isAdmin ? (
          <div className="border-t border-red-200 pt-6">
            <h3 className="text-xs font-semibold text-red-950">Hard delete — remove tournament from database</h3>
            <p className="mt-1 text-sm text-zinc-800">
              Permanently deletes this tournament and cascades: divisions, pools, teams, all games, brackets, sponsors,
              PWA/branding fields in the database, announcements, FAQ, feedback, media records, and the email subscriber
              list. The public URL <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">/{tournamentSlug}</code>{" "}
              will stop working. Files under{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">public/branding/{tournamentSlug}</code> are not
              removed automatically.
            </p>
            <ErrorBanner state={hardState} />
            <SuccessBanner state={hardState} />
            <form action={hardAction} className="mt-4 flex max-w-xl flex-col gap-3">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-800">
                <input type="checkbox" name="confirmHardUnderstand" className="mt-1 rounded border-zinc-300" />
                <span>
                  <span className={labelClass}>I understand this cannot be undone</span>
                  <span className="mt-0.5 block text-sm font-normal text-zinc-700">
                    I understand subscribers, announcements, and all structure will be lost.
                  </span>
                </span>
              </label>
              <div>
                <label htmlFor="confirmHardPhrase" className={`${labelClass} block`}>
                  Type the tournament slug to confirm
                </label>
                <input
                  id="confirmHardPhrase"
                  name="confirmHardPhrase"
                  type="text"
                  autoComplete="off"
                  placeholder={tournamentSlug}
                  className="mt-1 w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
                />
              </div>
              <button type="submit" disabled={hardPending} className={`${btnDestroy} w-fit`}>
                {hardPending ? "Deleting…" : "Delete tournament permanently"}
              </button>
            </form>
          </div>
        ) : (
          <p className="border-t border-red-200 pt-6 text-sm text-zinc-600">
            Only administrators can permanently delete a tournament.
          </p>
        )}
      </div>
    </section>
  );
}
