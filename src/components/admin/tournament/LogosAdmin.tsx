"use client";

import { useActionState } from "react";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import { updateTournamentLogo, updateTeamLogo } from "@/app/admin/_actions/logos";

const formClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";

function StatusBanner({ state }: { state: ContentActionResult | undefined }) {
  if (!state) return null;
  if (state.ok && state.notice) {
    return <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">{state.notice}</p>;
  }
  if (!state.ok) {
    return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">{state.error}</p>;
  }
  return null;
}

type TeamRow = { id: string; name: string; logoUrl: string | null; poolLabel: string };

export function LogosAdmin({
  tournamentLogoUrl,
  teams,
  canManage,
}: {
  tournamentLogoUrl: string | null;
  teams: TeamRow[];
  canManage: boolean;
}) {
  const [tState, tAction, tPending] = useActionState(
    updateTournamentLogo,
    undefined as ContentActionResult | undefined,
  );

  if (!canManage) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Logos</h2>
        <p className="mt-2 text-sm text-zinc-600">You don&apos;t have permission to manage logos.</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Tournament Logo</h2>
        <p className="mt-1 text-xs text-zinc-600">
          URL to the tournament logo image. Displayed in the site header.
        </p>
        <StatusBanner state={tState} />
        <form action={tAction} className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="tournament-logo" className={labelClass}>Logo URL</label>
            <input
              id="tournament-logo"
              name="logoUrl"
              type="url"
              placeholder="https://example.com/logo.png"
              defaultValue={tournamentLogoUrl ?? ""}
              className={`${formClass} mt-1 w-full`}
            />
          </div>
          {tournamentLogoUrl && (
            <img src={tournamentLogoUrl} alt="Current logo" className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200 object-contain" />
          )}
          <button type="submit" disabled={tPending} className={btnPrimary}>
            {tPending ? "Saving…" : "Save"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Team Logos</h2>
        <p className="mt-1 text-xs text-zinc-600">Set a logo URL for each team.</p>
        <div className="mt-4 flex flex-col gap-3">
          {teams.length === 0 ? (
            <p className="text-sm text-zinc-500">No teams yet.</p>
          ) : (
            teams.map((team) => (
              <TeamLogoRow key={team.id} team={team} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function TeamLogoRow({ team }: { team: TeamRow }) {
  const [state, action, pending] = useActionState(
    updateTeamLogo,
    undefined as ContentActionResult | undefined,
  );

  return (
    <form action={action} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3">
      <input type="hidden" name="teamId" value={team.id} />
      {team.logoUrl ? (
        <img src={team.logoUrl} alt={team.name} className="size-8 shrink-0 rounded border border-zinc-200 object-contain" />
      ) : (
        <div className="flex size-8 shrink-0 items-center justify-center rounded border border-dashed border-zinc-300 bg-zinc-50 text-[10px] font-bold text-zinc-400">
          {team.name.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900">{team.name}</p>
        <p className="text-[10px] text-zinc-500">{team.poolLabel}</p>
      </div>
      <input
        name="logoUrl"
        type="url"
        placeholder="Logo URL"
        defaultValue={team.logoUrl ?? ""}
        className={`${formClass} w-40 sm:w-56`}
      />
      <button type="submit" disabled={pending} className={`${btnPrimary} text-xs`}>
        {pending ? "…" : "Save"}
      </button>
      {state && !state.ok ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}
