import { prisma } from "@/lib/db";

const PROVIDER = "open-meteo";
/** Open-Meteo response cache (10–15 min range; HQ/coord changes use a new cache key). */
const CACHE_TTL_MS = 12 * 60 * 1000;

type OpenMeteoCurrent = {
  temperature_2m: number;
  weather_code: number;
  wind_speed_10m?: number;
};

type OpenMeteoDaily = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
};

export type WeatherWidgetPayload = {
  current: { tempF: number; code: number; windMph?: number };
  daily: { date: string; highF: number; lowF: number; code: number }[];
  fetchedAt: string;
};

function cacheKey(lat: number, lon: number): string {
  return `wx:${lat.toFixed(3)}:${lon.toFixed(3)}`;
}

export async function getWeatherForTournament(opts: {
  latitude: number;
  longitude: number;
}): Promise<WeatherWidgetPayload | null> {
  const { latitude, longitude } = opts;
  const key = cacheKey(latitude, longitude);
  const now = new Date();

  const cached = await prisma.weatherCache.findUnique({ where: { key } });
  if (cached && cached.expiresAt > now) {
    return cached.payload as unknown as WeatherWidgetPayload;
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "5");

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    current: OpenMeteoCurrent;
    daily: OpenMeteoDaily;
  };

  const daily = data.daily.time.map((date, i) => ({
    date,
    highF: Math.round(data.daily.temperature_2m_max[i] ?? 0),
    lowF: Math.round(data.daily.temperature_2m_min[i] ?? 0),
    code: data.daily.weather_code[i] ?? 0,
  }));

  const payload: WeatherWidgetPayload = {
    current: {
      tempF: Math.round(data.current.temperature_2m),
      code: data.current.weather_code,
      windMph: data.current.wind_speed_10m
        ? Math.round(data.current.wind_speed_10m)
        : undefined,
    },
    daily,
    fetchedAt: now.toISOString(),
  };

  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
  await prisma.weatherCache.upsert({
    where: { key },
    create: {
      key,
      provider: PROVIDER,
      payload: payload as object,
      fetchedAt: now,
      expiresAt,
    },
    update: {
      provider: PROVIDER,
      payload: payload as object,
      fetchedAt: now,
      expiresAt,
    },
  });

  return payload;
}
