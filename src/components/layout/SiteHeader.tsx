import Link from "next/link";
import { googleMapsUrl } from "@/lib/maps-links";

const nav = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/standings", label: "Standings" },
  { href: "/brackets", label: "Brackets" },
  { href: "/locations", label: "Locations" },
  { href: "/faq", label: "FAQ" },
] as const;

export type HeaderTournament = {
  name: string;
  logoUrl: string | null;
  hqLat: number | null;
  hqLon: number | null;
  hqQuery: string;
};

export function SiteHeader({ tournament }: { tournament: HeaderTournament | null }) {
  const mapsHref = tournament
    ? googleMapsUrl(tournament.hqLat, tournament.hqLon, tournament.hqQuery)
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-royal-200/80 bg-royal-900/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        {/* Left: logo + tournament name */}
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {tournament?.logoUrl ? (
            <img
              src={tournament.logoUrl}
              alt=""
              className="h-8 w-auto shrink-0 rounded object-contain"
            />
          ) : (
            <span className="shrink-0 text-lg font-bold tracking-tight text-white">
              R&O <span className="text-accent-light">2026</span>
            </span>
          )}
          {tournament ? (
            <span className="truncate text-sm font-medium text-white/90">
              {tournament.name}
            </span>
          ) : null}
        </Link>

        {/* Right: map pin (mobile) + desktop nav */}
        <div className="flex items-center gap-2">
          {mapsHref ? (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Get directions"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </a>
          ) : null}
          <nav className="hidden gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
