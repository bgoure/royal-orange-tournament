import { NextResponse } from "next/server";
import { getHeadquartersWeatherOutcomeForSlug } from "@/lib/services/weather-service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("tournament");
  if (!slug) {
    return NextResponse.json({ error: "tournament slug required" }, { status: 400 });
  }

  const out = await getHeadquartersWeatherOutcomeForSlug(slug);
  if (!out.ok) {
    if (out.reason === "no_headquarters") {
      return NextResponse.json({ error: "tournament headquarters location could not be resolved" }, { status: 404 });
    }
    return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
  }

  return NextResponse.json(out.weather);
}
