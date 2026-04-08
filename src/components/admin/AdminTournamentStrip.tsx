"use client";

import Link from "next/link";
import { useCreateTournamentWizard } from "@/components/admin/tournament/CreateTournamentWizardContext";

type Props = {
  currentTournamentName: string | null;
  currentTournamentSlug: string | null;
};

export function AdminTournamentStrip({ currentTournamentName, currentTournamentSlug }: Props) {
  const { open, canCreateTournament } = useCreateTournamentWizard();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-8 py-3">
      <div className="min-w-0 text-sm text-zinc-700">
        {currentTournamentName && currentTournamentSlug ? (
          <>
            <span className="font-medium text-zinc-900">Tournament:</span>{" "}
            <span className="truncate">{currentTournamentName}</span>{" "}
            <span className="hidden text-zinc-400 sm:inline">({currentTournamentSlug})</span>
          </>
        ) : (
          <span className="text-amber-900">
            No tournament selected — use <strong>Create tournament</strong> or choose one on the public
            site.
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canCreateTournament ? (
          <button
            type="button"
            onClick={open}
            className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
            title="Create tournament"
          >
            <span aria-hidden>+</span>
            <span className="ml-1.5 sm:inline">Create</span>
          </button>
        ) : null}
        <Link
          href="/"
          className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 hover:underline"
        >
          Public site
        </Link>
      </div>
    </div>
  );
}
