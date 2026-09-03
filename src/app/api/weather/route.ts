import { NextResponse } from "next/server";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { getHeadquartersWeatherOutcomeForSlug } from "@/lib/services/weather-service";

/** Slugs are short; anything longer is junk we shouldn't query on. */
const MAX_SLUG_CHARS = 120;
/** Upstream Open-Meteo calls are cached, but the DB lookups behind them are not free. */
const REQUEST_LIMIT = 60;
const REQUEST_WINDOW_MS = 5 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("tournament");
  if (!slug || slug.length > MAX_SLUG_CHARS) {
    return NextResponse.json({ error: "tournament slug required" }, { status: 400 });
  }

  const ip = clientIpFromHeaders(req.headers);
  const limit = await consumeRateLimit({
    scope: "weather:ip",
    subject: ip,
    limit: REQUEST_LIMIT,
    windowMs: REQUEST_WINDOW_MS,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let out;
  try {
    out = await getHeadquartersWeatherOutcomeForSlug(slug);
  } catch (e) {
    console.error("[weather] lookup failed:", e);
    return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
  }

  if (!out.ok) {
    if (out.reason === "no_headquarters") {
      return NextResponse.json({ error: "tournament headquarters location could not be resolved" }, { status: 404 });
    }
    return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
  }

  return NextResponse.json(out.weather, {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
