import Image from "next/image";
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
      <div className="flex w-full flex-wrap items-stretch">
        {/* Home: logo flush left (no padding), full bar height; title shares same link */}
        <Link
          href={tp()}
          className="flex min-w-0 shrink-0 items-stretch gap-2 sm:gap-3"
          aria-label="Royal & Orange Classic 2026"
        >
          <span className="relative flex shrink-0 items-stretch self-stretch overflow-hidden">
            <Image
              src="/RO_Header_Logo.jpeg"
              alt=""
              width={480}
              height={160}
              className="h-full w-auto max-h-none object-contain object-left"
              sizes="(max-width: 640px) 42vw, 260px"
              priority
            />
          </span>
          <span className="flex min-w-0 flex-col justify-center gap-0 py-3 leading-none">
            <span className="text-lg font-bold tracking-tight text-white">Royal &amp; Orange</span>
            <span className="text-lg font-bold tracking-tight text-accent">Classic 2026</span>
          </span>
        </Link>

        <div className="mx-auto flex min-w-0 flex-1 max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <div className="flex min-w-0 w-full flex-1 justify-end sm:w-auto">
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
      </div>
    </header>
  );
}
