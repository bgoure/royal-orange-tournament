import Link from "next/link";
import { TournamentSwitcher } from "@/components/layout/TournamentSwitcher";
import { listPublishedTournaments } from "@/lib/tournament-context";

const nav = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/standings", label: "Standings" },
  { href: "/brackets", label: "Brackets" },
  { href: "/locations", label: "Locations" },
  { href: "/faq", label: "FAQ" },
] as const;

export async function SiteHeader({ currentSlug }: { currentSlug: string }) {
  const tournaments = await listPublishedTournaments();
  const effectiveSlug = currentSlug || tournaments[0]?.slug || "";

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight text-zinc-900">
            Tournament <span className="text-emerald-700">Hub</span>
          </Link>
          {tournaments.length > 0 ? (
            <TournamentSwitcher tournaments={tournaments} currentSlug={effectiveSlug} />
          ) : null}
        </div>
        <nav className="hidden gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
