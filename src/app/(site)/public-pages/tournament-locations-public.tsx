import type { Tournament } from "@prisma/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/ui/PublicHeading";
import { formatLocationAddress } from "@/lib/location-utils";
import { appleMapsUrl, googleMapsUrl, wazeUrl } from "@/lib/maps-links";
import { publicGlassCardXl } from "@/lib/public-glass-card";
import { listLocations } from "@/lib/services/content";

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
        className="rounded-full border border-white/45 bg-white/80 px-4 py-2.5 text-xs font-semibold text-zinc-800 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md hover:bg-white/95 active:opacity-90 dark:border-zinc-600/50 dark:bg-zinc-900/70 dark:hover:bg-zinc-900/85"
      >
        Waze
      </a>
      <a
        href={a}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-white/45 bg-white/80 px-4 py-2.5 text-xs font-semibold text-zinc-800 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md hover:bg-white/95 active:opacity-90 dark:border-zinc-600/50 dark:bg-zinc-900/70 dark:hover:bg-zinc-900/85"
      >
        Apple Maps
      </a>
    </div>
  );
}

export async function TournamentLocationsPublic({ tournament }: { tournament: Tournament }) {
  const locations = await listLocations(tournament.id);

  return (
    <div className="flex flex-col gap-4">
      <section>
        <SectionTitle className="mb-3">Tournament Locations</SectionTitle>
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
                <li key={loc.id} className={`px-4 py-3 ${publicGlassCardXl}`}>
                  <p className="font-medium text-zinc-900">
                    {loc.name}
                    {loc.isHeadquarters ? (
                      <span className="ml-2 inline-block align-middle rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold tracking-[0.06em] text-white [font-variant:small-caps]">
                        Headquarters
                      </span>
                    ) : null}
                  </p>
                  {address ? <p className="mt-1 text-sm text-zinc-600">{address}</p> : null}
                  <MapLinks lat={loc.latitude} lon={loc.longitude} query={query} mapLink={loc.mapLink} />
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
