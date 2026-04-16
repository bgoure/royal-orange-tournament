import type { MetadataRoute } from "next";
import { getTournamentForRequest } from "@/lib/tournament-context";

export const dynamic = "force-dynamic";

const DEFAULT_NAME = "Royal & Orange Tournament Tracker";
const DEFAULT_SHORT = "Tournament Tracker";
const DEFAULT_DESC =
  "Track schedules, results, standings, and brackets for Royal & Orange tournaments";

function iconType(src: string): string {
  if (/\.(jpe?g)$/i.test(src)) return "image/jpeg";
  return "image/png";
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTournamentForRequest();
  const icon192 = t?.pwaIcon192Url?.trim() || "/icon-192.png";
  const icon512 = t?.pwaIcon512Url?.trim() || "/icon-512.png";
  const theme = t?.pwaThemeColor?.trim() || "#1a1a2e";

  return {
    name: t?.name ? `${t.name} · Tracker` : DEFAULT_NAME,
    short_name: t?.shortLabel?.trim() || DEFAULT_SHORT,
    description: DEFAULT_DESC,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: theme,
    orientation: "portrait-primary",
    icons: [
      {
        src: icon192,
        sizes: "192x192",
        type: iconType(icon192),
        purpose: "any",
      },
      {
        src: icon512,
        sizes: "512x512",
        type: iconType(icon512),
        purpose: "any",
      },
    ],
  };
}
