import Link from "next/link";
import { HeaderDivisionPills } from "@/components/layout/HeaderDivisionPills";
import type { DivisionTabDescriptor } from "@/lib/division-tabs";
import { publicSiteHeaderTitleLines } from "@/lib/tournament-header-display";
import { tournamentPathFromBase } from "@/lib/tournament-public-path";

export function SiteHeader({
  publicBasePath,
  tournamentName,
  tournamentShortLabel,
  divisionDescriptors,
  cookieDivision,
}: {
  publicBasePath: string;
  tournamentName: string;
  tournamentShortLabel: string | null;
  divisionDescriptors: DivisionTabDescriptor[];
  cookieDivision: string | null;
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
    <header className="border-b border-royal-200/80 bg-royal-900/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:py-3">
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

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <HeaderDivisionPills
            publicBasePath={publicBasePath}
            divisionDescriptors={divisionDescriptors}
            cookieDivision={cookieDivision}
          />
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
