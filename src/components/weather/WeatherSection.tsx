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
      <section className="flex items-center rounded-2xl border border-royal-200 bg-gradient-to-r from-royal-50 to-accent-50 px-4 py-3 shadow-sm">
        <p className="text-xs text-zinc-500">
          {out.reason === "no_headquarters"
            ? "Set tournament headquarters to show weather."
            : "Weather unavailable."}
        </p>
      </section>
    );
  }

  const { label: locationLabel, weather: wx } = out;

  return (
    <section className="rounded-2xl border border-royal-200 bg-gradient-to-r from-royal-50 via-white to-accent-50 px-4 py-3 shadow-sm" title={locationLabel}>
      <div className="flex items-center gap-3">
        {/* Current weather — left side */}
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-2xl text-royal drop-shadow-sm" aria-hidden>
            {emojiForCode(wx.current.code)}
          </span>
          <div>
            <p className="text-xl font-bold tabular-nums leading-tight text-royal">{wx.current.tempC}°C</p>
            <p className="text-[10px] text-zinc-600">{labelForCode(wx.current.code)}{wx.current.windKmh != null ? ` · ${wx.current.windKmh} km/h` : ""}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-10 w-px shrink-0 bg-zinc-200" />

        {/* 5-day forecast — right side, scrollable */}
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {wx.daily.slice(0, 5).map((d) => (
            <div
              key={d.date}
              className="flex min-w-[2.8rem] flex-1 flex-col items-center rounded-lg bg-white/60 px-1 py-1 text-center text-[10px]"
            >
              <p className="font-semibold text-zinc-700">
                {new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(new Date(d.date + "T12:00:00"))}
              </p>
              <p className="tabular-nums text-zinc-500">
                {d.highC}°/{d.lowC}°
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
