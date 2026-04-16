import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { formatLocationAddress } from "@/lib/location-utils";

const GEO_PROVIDER = "open-meteo-geocode";
const GEO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeAddress(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function geoCacheKey(address: string): string {
  const h = createHash("sha256").update(normalizeAddress(address).toLowerCase()).digest("hex").slice(0, 40);
  return `geo:${h}`;
}

export async function geocodeAddressCached(address: string): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = normalizeAddress(address);
  if (!trimmed) return null;

  const key = geoCacheKey(trimmed);
  const now = new Date();
  const cached = await prisma.weatherCache.findUnique({ where: { key } });
  if (cached && cached.expiresAt > now) {
    const p = cached.payload as { latitude?: unknown; longitude?: unknown };
    if (typeof p.latitude === "number" && typeof p.longitude === "number") {
      return { latitude: p.latitude, longitude: p.longitude };
    }
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", trimmed);
  url.searchParams.set("count", "1");
  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return null;

  const data = (await res.json()) as { results?: { latitude: number; longitude: number }[] };
  const first = data.results?.[0];
  if (!first) return null;

  const coords = { latitude: first.latitude, longitude: first.longitude };
  const expiresAt = new Date(now.getTime() + GEO_CACHE_TTL_MS);
  await prisma.weatherCache.upsert({
    where: { key },
    create: {
      key,
      provider: GEO_PROVIDER,
      payload: coords as object,
      fetchedAt: now,
      expiresAt,
    },
    update: {
      provider: GEO_PROVIDER,
      payload: coords as object,
      fetchedAt: now,
      expiresAt,
    },
  });

  return coords;
}

function finitePair(lat: number | null | undefined, lon: number | null | undefined): { latitude: number; longitude: number } | null {
  if (lat == null || lon == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { latitude: lat, longitude: lon };
}

export type HeadquartersCoordsResult = {
  latitude: number;
  longitude: number;
  label: string;
};

/**
 * Resolves coordinates for weather: the single `Location` with `isHeadquarters` for this tournament.
 * Uses stored latitude/longitude when both are set; otherwise geocodes the location’s address.
 * No tournament-level fallback — if there is no HQ row or resolvable coordinates, returns null.
 */
export async function resolveTournamentHeadquartersCoordinates(
  tournamentId: string,
): Promise<HeadquartersCoordsResult | null> {
  const hq = await prisma.location.findFirst({
    where: { tournamentId, isHeadquarters: true },
  });
  if (!hq) return null;

  const label = hq.name.trim() || "Tournament headquarters";

  const fromHqCoords = finitePair(hq.latitude, hq.longitude);
  if (fromHqCoords) return { ...fromHqCoords, label };

  const hqAddr = formatLocationAddress(hq).trim();
  if (hqAddr) {
    const g = await geocodeAddressCached(hqAddr);
    if (g) return { latitude: g.latitude, longitude: g.longitude, label };
  }

  return null;
}

export async function resolveTournamentHeadquartersCoordinatesBySlug(
  slug: string,
): Promise<HeadquartersCoordsResult | null> {
  const t = await prisma.tournament.findFirst({
    where: {
      slug: { equals: slug, mode: "insensitive" },
      isPublished: true,
    },
    select: { id: true },
  });
  if (!t) return null;
  return resolveTournamentHeadquartersCoordinates(t.id);
}
