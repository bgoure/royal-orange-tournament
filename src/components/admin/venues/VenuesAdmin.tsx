"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Location } from "@prisma/client";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import {
  createVenue,
  deleteVenue,
  moveVenue,
  setLocationAsHeadquarters,
  updateVenue,
} from "@/app/admin/_actions/venues";
import { ConfirmForm } from "@/components/admin/structure/ConfirmForm";

const formClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const btnDanger =
  "rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100";
const btnGhost = "rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50";

function ErrorBanner({ state }: { state: ContentActionResult | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">
      {state.error}
    </p>
  );
}

function SuccessLine({ state }: { state: ContentActionResult | undefined }) {
  if (!state || !state.ok || !state.notice) return null;
  return <p className="text-xs text-emerald-800">{state.notice}</p>;
}

export function VenuesAdmin({
  locations,
  tournamentName,
  canManage,
}: {
  locations: Location[];
  tournamentName: string;
  canManage: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(
    createVenue,
    undefined as ContentActionResult | undefined,
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Locations</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
          <p className="mt-2 max-w-xl text-xs text-zinc-500">
            Manage park sites here; add diamonds under <strong>Fields</strong>. Use <strong>Set as headquarters</strong>{" "}
            for weather and public HQ (one per tournament).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/fields" className={btnSecondary}>
            Fields
          </Link>
          <Link href="/admin/faq" className={btnSecondary}>
            FAQ
          </Link>
          <Link href="/admin/tournament-settings" className={btnSecondary}>
            Tournament HQ
          </Link>
          <Link href="/locations" className={btnSecondary}>
            View public page ↗
          </Link>
        </div>
      </header>

      {!canManage ? (
        <p className="text-sm text-zinc-600">You don’t have permission to manage locations.</p>
      ) : (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">New location</h2>
            <ErrorBanner state={createState} />
            <form action={createAction} className="mt-4 flex max-w-2xl flex-col gap-4">
              <div>
                <label htmlFor="v-name" className={labelClass}>
                  Name
                </label>
                <input id="v-name" name="name" required className={`${formClass} mt-1 w-full`} />
              </div>
              <div>
                <label htmlFor="v-address" className={labelClass}>
                  Address (full line, recommended)
                </label>
                <textarea id="v-address" name="address" rows={2} className={`${formClass} mt-1 w-full`} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="v-lat" className={labelClass}>
                    Latitude
                  </label>
                  <input id="v-lat" name="latitude" className={`${formClass} mt-1 w-full`} placeholder="e.g. 30.5086" />
                </div>
                <div>
                  <label htmlFor="v-lon" className={labelClass}>
                    Longitude
                  </label>
                  <input id="v-lon" name="longitude" className={`${formClass} mt-1 w-full`} placeholder="e.g. -97.6789" />
                </div>
              </div>
              <div>
                <label htmlFor="v-map" className={labelClass}>
                  Custom map link (optional)
                </label>
                <input id="v-map" name="mapLink" type="url" className={`${formClass} mt-1 w-full`} />
              </div>
              <div>
                <label htmlFor="v-sort" className={labelClass}>
                  Sort order (optional)
                </label>
                <input id="v-sort" name="sortOrder" type="number" className={`${formClass} mt-1 w-full max-w-xs`} />
              </div>
              <button type="submit" disabled={createPending} className={`${btnPrimary} w-fit`}>
                {createPending ? "Saving…" : "Add location"}
              </button>
            </form>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">Existing</h2>
            {locations.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No locations yet.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-6">
                {locations.map((loc, i) => (
                  <LocationEditRow key={loc.id} location={loc} index={i} total={locations.length} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function LocationEditRow({ location: loc, index, total }: { location: Location; index: number; total: number }) {
  const [updState, updAction, updPending] = useActionState(
    updateVenue,
    undefined as ContentActionResult | undefined,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteVenue,
    undefined as ContentActionResult | undefined,
  );
  const [hqState, hqAction, hqPending] = useActionState(
    setLocationAsHeadquarters,
    undefined as ContentActionResult | undefined,
  );
  const [upState, upAction, upPending] = useActionState(moveVenue, undefined as ContentActionResult | undefined);
  const [downState, downAction, downPending] = useActionState(
    moveVenue,
    undefined as ContentActionResult | undefined,
  );

  return (
    <li className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {loc.isHeadquarters ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
              Headquarters
            </span>
          ) : null}
          {!loc.isHeadquarters ? (
            <form action={hqAction} className="inline">
              <input type="hidden" name="id" value={loc.id} />
              <button
                type="submit"
                disabled={hqPending}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
              >
                {hqPending ? "…" : "Set as headquarters"}
              </button>
            </form>
          ) : null}
          <form action={upAction} className="inline">
            <input type="hidden" name="id" value={loc.id} />
            <input type="hidden" name="direction" value="up" />
            <button type="submit" disabled={upPending || index === 0} className={btnGhost}>
              Move up
            </button>
          </form>
          <form action={downAction} className="inline">
            <input type="hidden" name="id" value={loc.id} />
            <input type="hidden" name="direction" value="down" />
            <button type="submit" disabled={downPending || index >= total - 1} className={btnGhost}>
              Move down
            </button>
          </form>
          <span className="self-center text-xs text-zinc-500">Order: {loc.sortOrder}</span>
        </div>
        <ConfirmForm message="Delete this location?" action={delAction} className="inline">
          <input type="hidden" name="id" value={loc.id} />
          <button type="submit" disabled={delPending} className={btnDanger}>
            Delete
          </button>
        </ConfirmForm>
      </div>
      <SuccessLine state={hqState} />
      <ErrorBanner state={updState ?? delState ?? upState ?? downState ?? hqState} />
      <form action={updAction} className="grid max-w-2xl grid-cols-1 gap-3">
        <input type="hidden" name="id" value={loc.id} />
        <div>
          <label className={labelClass}>Name</label>
          <input name="name" required defaultValue={loc.name} className={`${formClass} mt-1 w-full`} />
        </div>
        <div>
          <label className={labelClass}>Address (full line)</label>
          <textarea name="address" rows={2} defaultValue={loc.address ?? ""} className={`${formClass} mt-1 w-full`} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Latitude</label>
            <input
              name="latitude"
              defaultValue={loc.latitude != null ? String(loc.latitude) : ""}
              className={`${formClass} mt-1 w-full`}
            />
          </div>
          <div>
            <label className={labelClass}>Longitude</label>
            <input
              name="longitude"
              defaultValue={loc.longitude != null ? String(loc.longitude) : ""}
              className={`${formClass} mt-1 w-full`}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Custom map link</label>
          <input name="mapLink" type="url" defaultValue={loc.mapLink ?? ""} className={`${formClass} mt-1 w-full`} />
        </div>
        <div>
          <label className={labelClass}>Sort order</label>
          <input
            name="sortOrder"
            type="number"
            defaultValue={loc.sortOrder}
            className={`${formClass} mt-1 w-full max-w-xs`}
          />
        </div>
        <button type="submit" disabled={updPending} className={`${btnSecondary} w-fit px-3 py-2 text-sm`}>
          {updPending ? "Saving…" : "Update"}
        </button>
      </form>
    </li>
  );
}
