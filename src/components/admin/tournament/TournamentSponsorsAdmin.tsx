"use client";

import { useActionState } from "react";
import { updateShowPublicSponsorsSection } from "@/app/admin/_actions/tournament-public-sections";
import {
  deleteTournamentSponsor,
  uploadTournamentSponsorLogo,
} from "@/app/admin/_actions/sponsors";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import { sponsorLogoUrl } from "@/lib/sponsor-logo";
import { MAX_TOURNAMENT_SPONSORS } from "@/lib/sponsors-constants";

export type SponsorRow = { id: string; updatedAt: Date };

const labelClass = "block text-xs font-medium uppercase tracking-wide text-zinc-500";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const btnDanger =
  "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50";

type Props = {
  sponsors: SponsorRow[];
  canManage: boolean;
  showPublicSponsorsSection: boolean;
};

const segBtn = (active: boolean) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    active ? "bg-emerald-600 text-white shadow-sm" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
  }`;

export function TournamentSponsorsAdmin({ sponsors, canManage, showPublicSponsorsSection }: Props) {
  const [visibilityState, visibilityAction, visibilityPending] = useActionState(
    updateShowPublicSponsorsSection,
    undefined as ContentActionResult | undefined,
  );
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadTournamentSponsorLogo,
    undefined as ContentActionResult | undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTournamentSponsor,
    undefined as ContentActionResult | undefined,
  );

  const atLimit = sponsors.length >= MAX_TOURNAMENT_SPONSORS;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Home page — Sponsors section</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Hide the entire sponsors block on the public home page, or show it (logos or placeholders).
        </p>
        <ActionMessage state={visibilityState} />
        {canManage ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <form action={visibilityAction} className="inline">
              <input type="hidden" name="showPublicSponsorsSection" value="true" />
              <button type="submit" disabled={visibilityPending || showPublicSponsorsSection} className={segBtn(showPublicSponsorsSection)}>
                Show section
              </button>
            </form>
            <form action={visibilityAction} className="inline">
              <input type="hidden" name="showPublicSponsorsSection" value="false" />
              <button type="submit" disabled={visibilityPending || !showPublicSponsorsSection} className={segBtn(!showPublicSponsorsSection)}>
                Hide section
              </button>
            </form>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">Current: {showPublicSponsorsSection ? "Visible" : "Hidden"}</p>
        )}
      </section>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Sponsor logos</h2>
        <p className="mt-1 text-sm text-zinc-600">
          When the section is visible, logos appear in a scrolling row on the public home page. Up to{" "}
          {MAX_TOURNAMENT_SPONSORS} images (PNG, JPEG, or WebP, max 400KB each). With no logos, visitors see
          placeholders.
        </p>
      </div>

      <ActionMessage state={uploadState} />
      <ActionMessage state={deleteState} />

      {canManage && !atLimit ? (
        <form action={uploadAction} encType="multipart/form-data" className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="sponsor-logo" className={labelClass}>
              Add sponsor logo
            </label>
            <input
              id="sponsor-logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-1 block text-sm text-zinc-700"
            />
          </div>
          <button type="submit" disabled={uploadPending} className={btnSecondary}>
            {uploadPending ? "Uploading…" : "Upload"}
          </button>
        </form>
      ) : null}

      {canManage && atLimit ? (
        <p className="text-sm text-amber-800">Sponsor limit reached ({MAX_TOURNAMENT_SPONSORS}). Remove one to add another.</p>
      ) : null}

      {sponsors.length === 0 ? (
        <p className="text-sm text-zinc-500">No sponsor logos yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 shadow-sm"
            >
              <div className="flex h-24 items-center justify-center rounded-lg bg-white p-2 ring-1 ring-zinc-200/80">
                {/* eslint-disable-next-line @next/next/no-img-element -- API-served bytes like team logos */}
                <img
                  src={sponsorLogoUrl(s.id, s.updatedAt)}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              {canManage ? (
                <form action={deleteAction}>
                  <input type="hidden" name="sponsorId" value={s.id} />
                  <button type="submit" disabled={deletePending} className={`${btnDanger} w-full`}>
                    {deletePending ? "…" : "Remove"}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
