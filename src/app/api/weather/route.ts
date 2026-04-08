import { NextResponse } from "next/server";
import { getTournamentBySlug } from "@/lib/services/tournaments";
import { getWeatherForTournament } from "@/lib/services/weather";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("tournament");
  if (!slug) {
    return NextResponse.json({ error: "tournament slug required" }, { status: 400 });
  }

  const t = await getTournamentBySlug(slug);
  if (!t?.latitude || !t?.longitude) {
    return NextResponse.json({ error: "tournament has no coordinates" }, { status: 404 });
  }

  const weather = await getWeatherForTournament({
    latitude: t.latitude,
    longitude: t.longitude,
  });

  if (!weather) {
    return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
  }

  return NextResponse.json(weather);
}
