import Link from "next/link";
import { Suspense } from "react";
import { SiteHeaderDivisionTabs } from "@/components/layout/SiteHeaderDivisionTabs";
import type { DivisionTabDescriptor } from "@/lib/division-tabs";
import { tournamentPath } from "@/lib/tournament-public-path";

export async function SiteHeader({
  tournamentSlug,
  divisionTabDescriptors,
  cookieDivision,
}: {
  tournamentSlug: string;
  divisionTabDescriptors: DivisionTabDescriptor[];
  cookieDivision: string | null;
}) {
  const tp = (...s: string[]) => tournamentPath(tournamentSlug, ...s);
  const nav = [
    { href: tp(), label: "Home" },
    { href: tp("schedule"), label: "Schedule & Results" },
    { href: tp("standings"), label: "Standings" },
    { href: tp("brackets"), label: "Brackets" },
    { href: tp("locations"), label: "Locations" },
    { href: tp("faq"), label: "FAQ" },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-royal-200/80 bg-royal-900/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 w-full flex-1 flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href={tp()}
            className="flex shrink-0 flex-col gap-0 leading-none"
            aria-label="Royal & Orange Classic 2026"
          >
            <span className="text-lg font-bold tracking-tight text-white">Royal &amp; Orange</span>
            <span className="text-lg font-bold tracking-tight text-accent">Classic 2026</span>
          </Link>
          <div className="flex min-w-0 flex-1 justify-end">
            <Suspense
              fallback={
                <div className="ml-auto flex min-h-11 w-fit flex-wrap justify-end gap-2" aria-hidden>
                  <span className="h-11 w-12 animate-pulse rounded-full bg-white/15" />
                  <span className="h-11 w-12 animate-pulse rounded-full bg-white/15" />
                  <span className="h-11 w-12 animate-pulse rounded-full bg-white/15" />
                </div>
              }
            >
              <SiteHeaderDivisionTabs
                tournamentSlug={tournamentSlug}
                divisionDescriptors={divisionTabDescriptors}
                cookieDivision={cookieDivision}
              />
            </Suspense>
          </div>
        </div>
        <nav className="hidden gap-1 md:flex md:shrink-0">
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
    </header>
  );
}
