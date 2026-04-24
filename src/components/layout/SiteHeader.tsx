import Link from "next/link";
import { SiteHeaderDivisionTabs } from "@/components/layout/SiteHeaderDivisionTabs";
import type { DivisionTabDescriptor } from "@/lib/division-tabs";
import { publicSiteHeaderTitleLines } from "@/lib/tournament-header-display";
import { tournamentPathFromBase } from "@/lib/tournament-public-path";

export function SiteHeader({
  tournamentSlug,
  publicBasePath,
  divisionTabDescriptors,
  cookieDivision,
  tournamentName,
  tournamentShortLabel,
}: {
  tournamentSlug: string;
  publicBasePath: string;
  divisionTabDescriptors: DivisionTabDescriptor[];
  cookieDivision: string | null;
  tournamentName: string;
  tournamentShortLabel: string | null;
}) {
  const tp = (...s: string[]) => tournamentPathFromBase(publicBasePath, ...s);
  const nav = [
    { href: tp(), label: "Home" },
    { href: tp("schedule"), label: "Schedule" },
    { href: tp("results"), label: "Results" },
    { href: tp("brackets"), label: "Brackets" },
    { href: tp("locations"), label: "Locations" },
    { href: tp("rules"), label: "Rules" },
  ] as const;

  const { primary, accent } = publicSiteHeaderTitleLines({
    name: tournamentName,
    shortLabel: tournamentShortLabel,
  });

  return (
    <header className="sticky top-0 z-40 border-b border-royal-200/80 bg-royal-900/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 w-full flex-1 flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href={tp()}
            className="flex min-w-0 shrink-0 flex-col leading-none"
            aria-label={tournamentName}
          >
            <span className="text-[1.65rem] font-bold leading-[1.05] tracking-tight text-white sm:text-4xl md:text-[2.35rem]">
              {primary}
            </span>
            {accent ? (
              <span className="mt-1 self-end text-sm font-bold leading-none tracking-tight text-accent sm:text-base">
                {accent}
              </span>
            ) : null}
          </Link>
          <div className="flex min-w-0 flex-1 justify-end">
            <SiteHeaderDivisionTabs
              tournamentSlug={tournamentSlug}
              publicBasePath={publicBasePath}
              divisionDescriptors={divisionTabDescriptors}
              cookieDivision={cookieDivision}
            />
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
