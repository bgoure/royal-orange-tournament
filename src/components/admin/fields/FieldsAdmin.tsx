"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Field, Location } from "@prisma/client";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import { createField, deleteField, moveField, updateField } from "@/app/admin/_actions/fields";
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

export type LocationWithFields = Location & { fields: Field[] };

function ErrorBanner({ state }: { state: ContentActionResult | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">
      {state.error}
    </p>
  );
}

export function FieldsAdmin({
  groups,
  tournamentName,
  canManage,
}: {
  groups: LocationWithFields[];
  tournamentName: string;
  canManage: boolean;
}) {
  const [createRootState, createRootAction, createRootPending] = useActionState(
    createField,
    undefined as ContentActionResult | undefined,
  );

  const hasLocations = groups.length > 0;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Fields</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
          <p className="mt-2 max-w-xl text-xs text-zinc-500">
            Diamonds and playable fields belong to a location. Games reference a single field.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/locations" className={btnSecondary}>
            Locations
          </Link>
          <Link href="/admin/games" className={btnSecondary}>
            Games
          </Link>
          <Link href="/schedule" className={btnSecondary}>
            View schedule &amp; results ↗
          </Link>
        </div>
      </header>

      {!canManage ? (
        <p className="text-sm text-zinc-600">You don’t have permission to manage fields.</p>
      ) : !hasLocations ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
          Add at least one <Link href="/admin/locations" className="font-semibold underline">location</Link> before
          creating fields.
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Quick add field</h2>
            <p className="mt-1 text-xs text-zinc-500">Choose a location, then name the diamond (e.g. Field A).</p>
            <ErrorBanner state={createRootState} />
            <form action={createRootAction} className="mt-4 flex max-w-2xl flex-col gap-4">
              <div>
                <label htmlFor="qf-loc" className={labelClass}>
                  Location
                </label>
                <select id="qf-loc" name="locationId" required className={`${formClass} mt-1 w-full`}>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {g.isHeadquarters ? " (HQ)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="qf-name" className={labelClass}>
                  Field name
                </label>
                <input id="qf-name" name="name" required className={`${formClass} mt-1 w-full`} placeholder="Diamond 1" />
              </div>
              <div>
                <label htmlFor="qf-sort" className={labelClass}>
                  Sort order (optional)
                </label>
                <input id="qf-sort" name="sortOrder" type="number" className={`${formClass} mt-1 w-full max-w-xs`} />
              </div>
              <button type="submit" disabled={createRootPending} className={`${btnPrimary} w-fit`}>
                {createRootPending ? "Saving…" : "Add field"}
              </button>
            </form>
          </section>

          <div className="flex flex-col gap-8">
            {groups.map((loc) => (
              <LocationFieldSection key={loc.id} location={loc} allLocations={groups} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LocationFieldSection({
  location: loc,
  allLocations,
}: {
  location: LocationWithFields;
  allLocations: LocationWithFields[];
}) {
  const [createState, createAction, createPending] = useActionState(
    createField,
    undefined as ContentActionResult | undefined,
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 shadow-sm">
      <div className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-zinc-900">{loc.name}</h2>
          {loc.isHeadquarters ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
              Headquarters
            </span>
          ) : null}
          <span className="text-xs text-zinc-500">
            {loc.fields.length} field{loc.fields.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Add field here</h3>
          <ErrorBanner state={createState} />
          <form action={createAction} className="mt-3 flex max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <input type="hidden" name="locationId" value={loc.id} />
            <div className="min-w-[12rem] flex-1">
              <label className={labelClass}>Name</label>
              <input name="name" required className={`${formClass} mt-1 w-full`} placeholder="Diamond 2" />
            </div>
            <button type="submit" disabled={createPending} className={`${btnSecondary} h-fit shrink-0`}>
              {createPending ? "…" : "Add"}
            </button>
          </form>
        </div>

        {loc.fields.length === 0 ? (
          <p className="text-sm text-zinc-500">No fields at this location yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {loc.fields.map((f, idx) => (
              <FieldEditRow
                key={f.id}
                field={f}
                index={idx}
                total={loc.fields.length}
                allLocations={allLocations}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function FieldEditRow({
  field: f,
  index,
  total,
  allLocations,
}: {
  field: Field;
  index: number;
  total: number;
  allLocations: LocationWithFields[];
}) {
  const [updState, updAction, updPending] = useActionState(
    updateField,
    undefined as ContentActionResult | undefined,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteField,
    undefined as ContentActionResult | undefined,
  );
  const [upState, upAction, upPending] = useActionState(moveField, undefined as ContentActionResult | undefined);
  const [downState, downAction, downPending] = useActionState(
    moveField,
    undefined as ContentActionResult | undefined,
  );

  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <form action={upAction} className="inline">
            <input type="hidden" name="id" value={f.id} />
            <input type="hidden" name="direction" value="up" />
            <button type="submit" disabled={upPending || index === 0} className={btnGhost}>
              Up
            </button>
          </form>
          <form action={downAction} className="inline">
            <input type="hidden" name="id" value={f.id} />
            <input type="hidden" name="direction" value="down" />
            <button type="submit" disabled={downPending || index >= total - 1} className={btnGhost}>
              Down
            </button>
          </form>
        </div>
        <ConfirmForm
          message="Delete this field? You can’t delete it if games still use it."
          action={delAction}
          className="inline"
        >
          <input type="hidden" name="id" value={f.id} />
          <button type="submit" disabled={delPending} className={btnDanger}>
            Delete
          </button>
        </ConfirmForm>
      </div>
      <ErrorBanner state={updState ?? delState ?? upState ?? downState} />
      <form action={updAction} className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={f.id} />
        <div className="sm:col-span-2">
          <label className={labelClass}>Field name</label>
          <input name="name" required defaultValue={f.name} className={`${formClass} mt-1 w-full`} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Location</label>
          <select
            name="locationId"
            required
            defaultValue={f.locationId}
            className={`${formClass} mt-1 w-full`}
          >
            {allLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Sort order</label>
          <input
            name="sortOrder"
            type="number"
            defaultValue={f.sortOrder}
            className={`${formClass} mt-1 w-full`}
          />
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={updPending} className={`${btnSecondary} px-3 py-2 text-sm`}>
            {updPending ? "Saving…" : "Update"}
          </button>
        </div>
      </form>
    </li>
  );
}
