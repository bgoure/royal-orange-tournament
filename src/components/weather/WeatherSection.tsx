import { getHeadquartersWeatherOutcomeForTournament } from "@/lib/services/weather-service";
import { WeatherInteractiveCard } from "@/components/weather/WeatherInteractiveCard";

export async function WeatherSection({ tournamentId }: { tournamentId: string }) {
  const out = await getHeadquartersWeatherOutcomeForTournament(tournamentId);
  if (!out.ok) {
    return (
      <section className="flex items-center rounded-2xl border border-royal-200/80 bg-gradient-to-r from-royal-50/90 to-accent-50/90 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md dark:border-royal-700/50 dark:from-royal-950/50 dark:to-zinc-900/60">
        <p className="text-xs text-zinc-500">
          {out.reason === "no_headquarters"
            ? "Set tournament headquarters to show weather."
            : "Weather unavailable."}
        </p>
      </section>
    );
  }

  const { label: locationLabel, weather: wx } = out;

  return <WeatherInteractiveCard locationLabel={locationLabel} wx={wx} />;
}
