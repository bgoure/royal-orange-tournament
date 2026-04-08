import type { WeatherWidgetPayload } from "@/lib/services/weather";
import { getWeatherForTournament } from "@/lib/services/weather";
import {
  resolveTournamentHeadquartersCoordinates,
  resolveTournamentHeadquartersCoordinatesBySlug,
} from "@/lib/services/weather-location";

/** Successful forecast for the tournament’s headquarters location. */
export type HeadquartersWeatherResult = {
  label: string;
  weather: WeatherWidgetPayload;
};

export type HeadquartersWeatherOutcome =
  | { ok: true; label: string; weather: WeatherWidgetPayload }
  | { ok: false; reason: "no_headquarters" | "forecast_unavailable" };

async function headquartersForecastOutcome(
  resolved: Awaited<ReturnType<typeof resolveTournamentHeadquartersCoordinates>>,
): Promise<HeadquartersWeatherOutcome> {
  if (!resolved) return { ok: false, reason: "no_headquarters" };
  const weather = await getWeatherForTournament({
    latitude: resolved.latitude,
    longitude: resolved.longitude,
  });
  if (!weather) return { ok: false, reason: "forecast_unavailable" };
  return { ok: true, label: resolved.label, weather };
}

/** Resolves HQ coordinates from DB (lat/lon or geocoded address), then returns cached Open-Meteo payload. */
export async function getHeadquartersWeatherOutcomeForTournament(tournamentId: string): Promise<HeadquartersWeatherOutcome> {
  const resolved = await resolveTournamentHeadquartersCoordinates(tournamentId);
  return headquartersForecastOutcome(resolved);
}

export async function getHeadquartersWeatherOutcomeForSlug(slug: string): Promise<HeadquartersWeatherOutcome> {
  const resolved = await resolveTournamentHeadquartersCoordinatesBySlug(slug);
  return headquartersForecastOutcome(resolved);
}

/** Convenience when callers only need data or null (e.g. simple widgets). */
export async function getHeadquartersWeatherForTournament(
  tournamentId: string,
): Promise<HeadquartersWeatherResult | null> {
  const out = await getHeadquartersWeatherOutcomeForTournament(tournamentId);
  if (!out.ok) return null;
  return { label: out.label, weather: out.weather };
}
