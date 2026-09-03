import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTournamentForRequest } from "@/lib/tournament-context";
import { getOrganizationBrandingForTournament } from "@/lib/services/organizations";

/**
 * Dynamic web app manifest — prefers organization white-label branding when present.
 */
export async function GET() {
  const tournament = await getTournamentForRequest();
  let name = "Tournament Hub";
  let themeColor = "#1a1a2e";
  let icon192 = "/icon-192.png";
  let icon512 = "/icon-512.png";

  if (tournament) {
    const brand = await getOrganizationBrandingForTournament(tournament.id);
    if (brand) {
      name = brand.name;
      themeColor = brand.themeColor;
      icon192 = brand.icon192;
      icon512 = brand.icon512;
    } else {
      name = tournament.name;
      themeColor = tournament.pwaThemeColor ?? themeColor;
      icon192 = tournament.pwaIcon192Url ?? icon192;
      icon512 = tournament.pwaIcon512Url ?? icon512;
    }
  } else {
    const org = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
      select: {
        brandName: true,
        name: true,
        primaryColor: true,
        pwaThemeColor: true,
        logoUrl: true,
      },
    });
    if (org) {
      name = org.brandName || org.name;
      themeColor = org.pwaThemeColor || org.primaryColor || themeColor;
      if (org.logoUrl) {
        icon192 = org.logoUrl;
        icon512 = org.logoUrl;
      }
    }
  }

  const manifest = {
    name,
    short_name: name.slice(0, 12),
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: themeColor,
    icons: [
      { src: icon192, sizes: "192x192", type: "image/png" },
      { src: icon512, sizes: "512x512", type: "image/png" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "content-type": "application/manifest+json",
      // Branding here is resolved from the tournament cookie, so a shared cache would hand
      // one organization's manifest to another. Keep it per-request and uncacheable.
      "cache-control": "private, no-store, max-age=0, must-revalidate",
      vary: "Cookie",
    },
  });
}
