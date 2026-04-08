import { getHeadquartersWeatherOutcomeForTournament } from "@/lib/services/weather-service";

function labelForCode(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code <= 48) return "Fog";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Storm";
}

export async function WeatherSection({ tournamentId }: { tournamentId: string }) {
  const out = await getHeadquartersWeatherOutcomeForTournament(tournamentId);
  if (!out.ok) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Weather</h2>
        <p className="mt-2 text-sm text-zinc-500">
          {out.reason === "no_headquarters"
            ? "Mark a location as tournament headquarters and add coordinates or a street address to show the forecast."
            : "Forecast temporarily unavailable."}
        </p>
      </section>
    );
  }

  const { label: locationLabel, weather: wx } = out;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Weather</h2>
          <p className="text-xs text-zinc-500">{locationLabel}</p>
        </div>
        <p className="text-xs text-zinc-400">
          Updated{" "}
          {new Intl.DateTimeFormat(undefined, {
            timeStyle: "short",
          }).format(new Date(wx.fetchedAt))}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-3xl font-semibold tabular-nums text-zinc-900">{wx.current.tempF}°F</p>
          <p className="text-sm text-zinc-600">{labelForCode(wx.current.code)}</p>
          {wx.current.windMph != null ? (
            <p className="text-xs text-zinc-500">Wind {wx.current.windMph} mph</p>
          ) : null}
        </div>
        <div className="flex flex-1 flex-wrap gap-2 min-[400px]:justify-end">
          {wx.daily.slice(0, 5).map((d) => (
            <div
              key={d.date}
              className="min-w-[4.5rem] rounded-lg bg-zinc-50 px-2 py-2 text-center text-xs text-zinc-700"
            >
              <p className="font-medium text-zinc-900">
                {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(d.date + "T12:00:00"))}
              </p>
              <p className="tabular-nums">
                {d.highF}° / {d.lowF}°
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
