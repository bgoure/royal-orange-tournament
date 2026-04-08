"use client";

import Link from "next/link";
import { useCreateTournamentWizard } from "@/components/admin/tournament/CreateTournamentWizardContext";

/**
 * Shown when `getTournamentForRequest()` is null. Must render under `CreateTournamentWizardProvider`.
 */
export function AdminNoTournamentPlaceholder() {
  const { open, canCreateTournament } = useCreateTournamentWizard();

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
      <h1 className="text-lg font-semibold text-amber-900">No tournament selected</h1>
      <p className="mt-2 text-sm text-amber-800">
        Create a new tournament to set up divisions, pools, and teams — or choose an existing one from the
        public site switcher and return here.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {canCreateTournament ? (
          <button
            type="button"
            onClick={open}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Create tournament
          </button>
        ) : (
          <p className="text-sm text-amber-800">Ask an administrator to create a tournament or grant access.</p>
        )}
        <Link
          href="/"
          className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100/80"
        >
          Open public site
        </Link>
      </div>
    </div>
  );
}
