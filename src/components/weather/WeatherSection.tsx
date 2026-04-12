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

function emojiForCode(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

export async function WeatherSection({ tournamentId }: { tournamentId: string }) {
  const out = await getHeadquartersWeatherOutcomeForTournament(tournamentId);
  if (!out.ok) {
    return (
      <section className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-gradient-to-br from-royal-50 to-accent-50 p-5 shadow-sm">
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
    <section className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-gradient-to-br from-royal-50 via-white to-accent-50 p-5 shadow-sm">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-3xl" aria-hidden>{emojiForCode(wx.current.code)}</span>
            <div>
              <p className="text-3xl font-bold tabular-nums text-zinc-900">{wx.current.tempC}°C</p>
              <p className="text-sm font-medium text-zinc-600">{labelForCode(wx.current.code)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium text-zinc-500">{locationLabel}</p>
            {wx.current.windKmh != null ? (
              <p className="text-[11px] text-zinc-400">Wind {wx.current.windKmh} km/h</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-1.5 overflow-x-auto">
        {wx.daily.slice(0, 5).map((d) => (
          <div
            key={d.date}
            className="flex min-w-[3.5rem] flex-1 flex-col items-center gap-0.5 rounded-xl bg-white/70 px-2 py-2 text-center text-[11px]"
          >
            <p className="font-semibold text-zinc-800">
              {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(d.date + "T12:00:00"))}
            </p>
            <span className="text-sm" aria-hidden>{emojiForCode(0)}</span>
            <p className="tabular-nums text-zinc-600">
              {d.highC}°/{d.lowC}°
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-right text-[10px] text-zinc-400">
        Updated{" "}
        {new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(wx.fetchedAt))}
      </p>
    </section>
  );
}
