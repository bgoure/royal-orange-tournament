import Link from "next/link";
import { Suspense } from "react";
import { SiteHeaderDivisionTabs } from "@/components/layout/SiteHeaderDivisionTabs";
import type { DivisionTabDescriptor } from "@/lib/division-tabs";

const nav = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule & Results" },
  { href: "/standings", label: "Standings" },
  { href: "/brackets", label: "Brackets" },
  { href: "/locations", label: "Locations" },
  { href: "/faq", label: "FAQ" },
] as const;

export async function SiteHeader({
  divisionTabDescriptors,
  cookieDivision,
}: {
  divisionTabDescriptors: DivisionTabDescriptor[];
  cookieDivision: string | null;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-royal-200/80 bg-royal-900/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
          <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-white">
            R&O <span className="text-accent-light">2026</span>
          </Link>
          <Suspense
            fallback={
              <div className="flex min-h-11 flex-wrap gap-2" aria-hidden>
                <span className="h-11 w-12 animate-pulse rounded-full bg-white/15" />
                <span className="h-11 w-12 animate-pulse rounded-full bg-white/15" />
                <span className="h-11 w-12 animate-pulse rounded-full bg-white/15" />
              </div>
            }
          >
            <SiteHeaderDivisionTabs
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
    </header>
  );
}
