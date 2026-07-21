"use client";

import Link from "next/link";
import { useState } from "react";
import { useCreateTournamentWizard } from "@/components/admin/tournament/CreateTournamentWizardContext";
import { ShareTournamentModal } from "@/components/admin/tournament/ShareTournamentModal";

type Props = {
  publicSiteHref: string;
  /** Absolute URL for clipboard / QR (falls back to path if origin unknown). */
  publicSiteAbsoluteUrl: string;
  currentTournamentSlug: string | null;
  currentTournamentName: string | null;
  /** Opens the mobile nav drawer (shown only below lg). */
  onOpenMobileNav?: () => void;
};

export function AdminTournamentStrip({
  publicSiteHref,
  publicSiteAbsoluteUrl,
  currentTournamentSlug,
  currentTournamentName,
  onOpenMobileNav,
}: Props) {
  const { open, canCreateTournament } = useCreateTournamentWizard();
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-2">
          {onOpenMobileNav ? (
            <button
              type="button"
              onClick={onOpenMobileNav}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 lg:hidden"
              aria-label="Open navigation"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
          <p className="truncate text-sm text-zinc-600">
            {currentTournamentSlug ? (
              <>
                Link for parents:{" "}
                <span className="font-mono text-zinc-800">{publicSiteHref}</span>
              </>
            ) : (
              <span className="text-amber-900">Select a tournament from the sidebar to manage an event.</span>
            )}
          </p>
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
              <span className="ml-1.5 hidden sm:inline">Create</span>
            </button>
          ) : null}
          {currentTournamentSlug && currentTournamentName ? (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
            >
              Share
            </button>
          ) : null}
          <Link
            href={publicSiteHref}
            className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 hover:underline"
            title={
              currentTournamentSlug
                ? `Open ${publicSiteHref}`
                : "Opens the default public tournament"
            }
          >
            Public site
          </Link>
        </div>
      </div>
      {currentTournamentSlug && currentTournamentName ? (
        <ShareTournamentModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          tournamentName={currentTournamentName}
          publicUrl={publicSiteAbsoluteUrl}
          publicPath={publicSiteHref}
        />
      ) : null}
    </>
  );
}
