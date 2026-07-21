import type { Metadata } from "next";
import type { Tournament } from "@prisma/client";
import { getRequestPublicOrigin } from "@/lib/request-public-origin";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const a = new Intl.DateTimeFormat("en-US", opts).format(start);
  const b = new Intl.DateTimeFormat("en-US", opts).format(end);
  return a === b ? a : `${a} – ${b}`;
}

/** Build per-tournament Open Graph / Twitter metadata for public site layouts. */
export async function buildTournamentPublicMetadata(tournament: Tournament): Promise<Metadata> {
  const origin = await getRequestPublicOrigin();
  const basePath = tournamentPublicBasePath(tournament);
  const url = origin ? `${origin}${basePath}` : basePath;
  const dates = formatDateRange(tournament.startDate, tournament.endDate);
  const location = tournament.locationLabel?.trim();
  const description = [dates, location].filter(Boolean).join(" · ") || "Schedules, scores, standings, and brackets.";
  const title = tournament.shortLabel?.trim() || tournament.name;
  const absoluteTitle = `${tournament.name} · Schedules & scores`;

  const iconPath = tournament.pwaIcon192Url?.trim() || "/icon-192.png";
  const imageUrl = iconPath.startsWith("http")
    ? iconPath
    : origin
      ? `${origin}${iconPath.startsWith("/") ? iconPath : `/${iconPath}`}`
      : iconPath;

  return {
    title: absoluteTitle,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: tournament.name,
      type: "website",
      images: [{ url: imageUrl, width: 192, height: 192, alt: tournament.name }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [imageUrl],
    },
    icons: tournament.pwaIcon192Url
      ? {
          icon: [{ url: tournament.pwaIcon192Url, sizes: "192x192", type: "image/png" }],
          apple: { url: tournament.pwaIcon192Url, sizes: "192x192", type: "image/png" },
        }
      : undefined,
  };
}
