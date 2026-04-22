import Image from "next/image";
import Link from "next/link";
import { SiteHeaderDivisionTabs } from "@/components/layout/SiteHeaderDivisionTabs";
import type { DivisionTabDescriptor } from "@/lib/division-tabs";
import { tournamentPathFromBase } from "@/lib/tournament-public-path";

export async function SiteHeader({
  tournamentSlug,
  publicBasePath,
  divisionTabDescriptors,
  cookieDivision,
}: {
  tournamentSlug: string;
  publicBasePath: string;
  divisionTabDescriptors: DivisionTabDescriptor[];
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

  return (
    <header className="sticky top-0 z-40 border-b border-royal-200/80 bg-royal-900/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 w-full flex-1 flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href={tp()}
            className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3 leading-none"
            aria-label="Royal & Orange Classic 2026"
          >
            <Image
              src="/RO_Header_Logo.jpeg"
              alt=""
              width={200}
              height={64}
              className="h-8 w-auto max-h-9 shrink-0 object-contain object-left sm:h-10"
              sizes="(max-width: 640px) 96px, 120px"
              priority
            />
            <span className="flex min-w-0 flex-col gap-0">
              <span className="text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl">
                Royal &amp; Orange
              </span>
              <span className="mt-px text-sm font-bold leading-tight tracking-tight text-accent sm:text-base">
                Classic 2026
              </span>
            </span>
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
