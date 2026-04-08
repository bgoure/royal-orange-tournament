import { listFaqItems, listVenues } from "@/lib/services/content";
import { getTournamentForRequest } from "@/lib/tournament-context";

function mapsUrl(lat: number | null, lon: number | null, address: string): string {
  if (lat != null && lon != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function wazeUrl(lat: number | null, lon: number | null, address: string): string {
  if (lat != null && lon != null) {
    return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(address)}`;
}

export default async function FaqPage() {
  const tournament = await getTournamentForRequest();
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  const [faqs, venues] = await Promise.all([
    listFaqItems(tournament.id),
    listVenues(tournament.id),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">FAQ &amp; locations</h1>
        <p className="text-sm text-zinc-600">Answers and venue links for {tournament.name}.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">FAQ</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {faqs.length === 0 ? (
            <li className="text-sm text-zinc-500">No FAQ entries yet.</li>
          ) : (
            faqs.map((f) => (
              <li key={f.id} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <p className="font-medium text-zinc-900">{f.question}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{f.answer}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Venues</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {venues.length === 0 ? (
            <li className="text-sm text-zinc-500">No venues listed.</li>
          ) : (
            venues.map((v) => {
              const line = [v.city, v.state].filter(Boolean).join(", ");
              const address = [v.street, line, v.postalCode]
                .filter((x): x is string => Boolean(x && x.trim()))
                .join(", ");
              const query = address || v.name;
              const g = mapsUrl(v.latitude, v.longitude, query);
              const w = wazeUrl(v.latitude, v.longitude, query);
              return (
                <li key={v.id} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                  <p className="font-medium text-zinc-900">{v.name}</p>
                  {address ? <p className="mt-1 text-sm text-zinc-600">{address}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={g}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Open in Google Maps
                    </a>
                    <a
                      href={w}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                    >
                      Open in Waze
                    </a>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
