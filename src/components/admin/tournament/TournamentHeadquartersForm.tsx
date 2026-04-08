"use client";

import { useActionState, useCallback, useState } from "react";
import Link from "next/link";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import { updateTournamentHeadquarters } from "@/app/admin/_actions/tournament-headquarters";

const formClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";

export type HeadquartersLocationOption = {
  id: string;
  name: string;
  addressLine: string;
  latitude: number | null;
  longitude: number | null;
};

export type TournamentHeadquartersState = {
  headquartersLocationId: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

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

export function TournamentHeadquartersForm({
  headquarters,
  locations,
  tournamentName,
  canManage,
}: {
  headquarters: TournamentHeadquartersState;
  locations: HeadquartersLocationOption[];
  tournamentName: string;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateTournamentHeadquarters,
    undefined as ContentActionResult | undefined,
  );

  const [locationId, setLocationId] = useState(headquarters.headquartersLocationId);
  const [name, setName] = useState(headquarters.name);
  const [address, setAddress] = useState(headquarters.address);
  const [lat, setLat] = useState(headquarters.latitude != null ? String(headquarters.latitude) : "");
  const [lon, setLon] = useState(headquarters.longitude != null ? String(headquarters.longitude) : "");

  const onLocationChange = useCallback(
    (id: string) => {
      setLocationId(id);
      if (!id) return;
      const loc = locations.find((x) => x.id === id);
      if (!loc) return;
      setName(loc.name);
      setAddress(loc.addressLine);
      setLat(loc.latitude != null ? String(loc.latitude) : "");
      setLon(loc.longitude != null ? String(loc.longitude) : "");
    },
    [locations],
  );

  if (!canManage) {
    return (
      <div className="flex flex-col gap-4">
        <header className="border-b border-zinc-200 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Tournament headquarters</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
        </header>
        <p className="text-sm text-zinc-600">You don’t have permission to edit tournament headquarters.</p>
      </div>
    );
  }

  if (!locationId || locations.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <header className="border-b border-zinc-200 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Tournament headquarters</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
        </header>
        <p className="text-sm text-zinc-600">
          Add at least one location under <strong>Locations</strong> before setting tournament headquarters.
        </p>
        <Link href="/admin/locations" className={btnSecondary}>
          Go to Locations
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Tournament headquarters</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Headquarters is a location with weather coordinates. Choose which location is marked headquarters and edit
            its details below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/faq" className={btnSecondary}>
            FAQ
          </Link>
          <Link href="/admin/locations" className={btnSecondary}>
            Locations
          </Link>
          <Link href="/" className={btnSecondary}>
            View site ↗
          </Link>
        </div>
      </header>

      <ErrorBanner state={state} />
      <SuccessBanner state={state} />

      <form action={action} className="flex max-w-2xl flex-col gap-4">
        <input type="hidden" name="headquartersLocationId" value={locationId} />
        <div>
          <label htmlFor="hq-loc" className={labelClass}>
            Headquarters location
          </label>
          <select
            id="hq-loc"
            value={locationId}
            onChange={(e) => onLocationChange(e.target.value)}
            className={`${formClass} mt-1 w-full`}
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Only one location per tournament can be headquarters (enforced in the database).
          </p>
        </div>
        <div>
          <label htmlFor="hq-name" className={labelClass}>
            Display name
          </label>
          <input
            id="hq-name"
            name="headquartersName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${formClass} mt-1 w-full`}
            placeholder="e.g. Main tournament complex"
          />
        </div>
        <div>
          <label htmlFor="hq-addr" className={labelClass}>
            Address (used for maps &amp; geocoding if coordinates omitted)
          </label>
          <textarea
            id="hq-addr"
            name="headquartersAddress"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            className={`${formClass} mt-1 w-full`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="hq-lat" className={labelClass}>
              Latitude (preferred)
            </label>
            <input
              id="hq-lat"
              name="headquartersLatitude"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className={`${formClass} mt-1 w-full`}
            />
          </div>
          <div>
            <label htmlFor="hq-lon" className={labelClass}>
              Longitude (preferred)
            </label>
            <input
              id="hq-lon"
              name="headquartersLongitude"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              className={`${formClass} mt-1 w-full`}
            />
          </div>
        </div>
        <button type="submit" disabled={pending} className={`${btnPrimary} w-fit`}>
          {pending ? "Saving…" : "Save headquarters"}
        </button>
      </form>
    </div>
  );
}
