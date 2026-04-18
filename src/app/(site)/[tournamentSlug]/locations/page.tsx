import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle, SectionTitle } from "@/components/ui/PublicHeading";
import { formatLocationAddress } from "@/lib/location-utils";
import { appleMapsUrl, googleMapsUrl, wazeUrl } from "@/lib/maps-links";
import { getHeadquartersLocation, listLocations } from "@/lib/services/content";
import { resolveTournamentHeadquartersCoordinates } from "@/lib/services/weather-location";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { tournamentPath } from "@/lib/tournament-public-path";

function MapLinks({
  lat,
  lon,
  query,
  mapLink,
}: {
  lat: number | null;
  lon: number | null;
  query: string;
  mapLink?: string | null;
}) {
  const g = googleMapsUrl(lat, lon, query);
  const w = wazeUrl(lat, lon, query);
  const a = appleMapsUrl(lat, lon, query);
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {mapLink?.trim() ? (
        <a
          href={mapLink.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 active:opacity-90"
        >
          Linked map
        </a>
      ) : null}
      <a
        href={g}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-royal-light px-4 py-2.5 text-xs font-semibold text-white hover:bg-royal active:opacity-90"
      >
        Google Maps
      </a>
      <a
        href={w}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 active:opacity-90"
      >
        Waze
      </a>
      <a
        href={a}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 active:opacity-90"
      >
        Apple Maps
      </a>
    </div>
  );
}

export default async function LocationsPage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  const [hq, locations, resolved] = await Promise.all([
    getHeadquartersLocation(tournament.id),
    listLocations(tournament.id),
    resolveTournamentHeadquartersCoordinates(tournament.id),
  ]);

  const hqName = hq?.name?.trim() || "Tournament headquarters";
  const hqAddressText = hq ? formatLocationAddress(hq) : "";

  const useLat = resolved?.latitude ?? null;
  const useLon = resolved?.longitude ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle>Locations</PageTitle>
        <p className="mt-2 text-sm text-zinc-600">Headquarters and venues for {tournament.name}.</p>
        <p className="mt-2 text-sm">
          <Link href={tournamentPath(tournamentSlug, "faq")} className="font-medium text-royal-light underline-offset-2 hover:underline">
            ← FAQ
          </Link>
        </p>
      </div>

      <section>
        <SectionTitle className="mb-3">Tournament headquarters</SectionTitle>
        <ul className="mt-3 flex flex-col gap-3">
          <li className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <p className="font-medium text-zinc-900">{hqName}</p>
            {hqAddressText ? <p className="mt-1 text-sm text-zinc-600">{hqAddressText}</p> : null}
            <p className="mt-2 text-xs text-zinc-500">
              Weather uses the headquarters location only (coordinates when set, otherwise a geocoded street address).
            </p>
            <MapLinks lat={useLat} lon={useLon} query={hqAddressText || tournament.name} />
          </li>
        </ul>
      </section>

      <section>
        <SectionTitle className="mb-3">All locations</SectionTitle>
        <ul className="mt-3 flex flex-col gap-3">
          {locations.length === 0 ? (
            <li className="list-none">
              <EmptyState
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                }
                title="No venues listed yet"
                description="Locations will appear here when added for this tournament."
              />
            </li>
          ) : (
            locations.map((loc) => {
              const address = formatLocationAddress(loc);
              const query = address || loc.name;
              return (
                <li key={loc.id} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                  <p className="font-medium text-zinc-900">
                    {loc.name}
                    {loc.isHeadquarters ? (
                      <span className="ml-2 text-xs font-normal text-royal-light">(headquarters)</span>
                    ) : null}
                  </p>
                  {address ? <p className="mt-1 text-sm text-zinc-600">{address}</p> : null}
                  <MapLinks
                    lat={loc.latitude}
                    lon={loc.longitude}
                    query={query}
                    mapLink={loc.mapLink}
                  />
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
