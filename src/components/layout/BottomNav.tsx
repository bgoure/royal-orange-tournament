"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Drawer } from "vaul";
import { tournamentPath } from "@/lib/tournament-public-path";

export function BottomNav({
  tournamentSlug,
  showPublicAnnouncements = true,
}: {
  tournamentSlug: string;
  /** When false, announcements are omitted from the More drawer (matches Tournament HQ setting). */
  showPublicAnnouncements?: boolean;
}) {
  const pathname = usePathname();
  const tp = (...s: string[]) => tournamentPath(tournamentSlug, ...s);
  const [moreOpen, setMoreOpen] = useState(false);

  const moreLinks = [
    ...(showPublicAnnouncements
      ? ([
          {
            href: tp("announcements"),
            label: "Announcements",
            description: "Current and past tournament updates",
          },
        ] as const)
      : []),
    { href: tp("locations"), label: "Locations", description: "Game Fields and Directions" },
    {
      href: tp("rules"),
      label: "Tournament Rules & Resources",
      description: "Rules for Royal & Classic and OBA resources",
    },
    { href: tp("social"), label: "Social", description: "Follow Baseball Milton" },
    { href: tp("settings"), label: "Settings", description: "App preferences" },
  ] as const;

  const tabs = [
    {
      key: "home" as const,
      href: tp(),
      label: "Home",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-6">
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
        </svg>
      ),
    },
    {
      key: "schedule" as const,
      href: tp("schedule"),
      label: "Schedule",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-6">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    },
    {
      key: "results" as const,
      href: tp("results"),
      label: "Results",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-6">
          <path d="M8 21V16M12 21V10M16 21V4" />
        </svg>
      ),
    },
    {
      key: "brackets" as const,
      href: tp("brackets"),
      label: "Brackets",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-6">
          <path d="M4 4v6h4M4 7h4M20 4v6h-4M20 7h-4M4 20v-6h4M4 17h4M20 20v-6h-4M20 17h-4M8 7h2a2 2 0 012 2v6a2 2 0 01-2 2H8M16 7h-2a2 2 0 00-2 2v6a2 2 0 002 2h2" />
        </svg>
      ),
    },
  ] as const;

  const matchPrefixes = [
    ...(showPublicAnnouncements ? [tp("announcements")] : []),
    tp("rules"),
    tp("locations"),
    tp("more"),
    tp("settings"),
    tp("social"),
    tp("feedback"),
  ];

  const parts = pathname.split("/").filter(Boolean);
  const firstSeg = parts[0] ?? "";
  const secondSeg = parts[1] ?? "";

  const morePathActive =
    firstSeg === tournamentSlug &&
    matchPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const pillClass = (active: boolean) =>
    `flex min-h-[62px] min-w-[62px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-semibold leading-tight transition-colors active:scale-[0.98] ${
      active ? "bg-royal-50 text-royal ring-2 ring-royal/25" : "text-accent active:text-accent-700"
    }`;

  const closeMore = useCallback(() => setMoreOpen(false), []);

  return (
    <Drawer.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200/80 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="mx-auto flex min-h-[62px] max-w-lg items-center justify-around px-2 py-1">
            {tabs.map((t) => {
              let active = false;
              if (firstSeg !== tournamentSlug) {
                active = false;
              } else if (t.key === "home") {
                active = secondSeg === "";
              } else {
                active = secondSeg === t.key;
              }
              return (
                <Link key={t.href} href={t.href} className={pillClass(active)}>
                  {t.icon}
                  {t.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={pillClass(morePathActive || moreOpen)}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-6">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
              More
            </button>
          </div>
        </nav>

        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[60] mt-24 flex max-h-[85vh] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] outline-none">
            <Drawer.Title className="sr-only">More</Drawer.Title>
            <div className="flex shrink-0 justify-center pt-3">
              <Drawer.Handle className="h-1 w-10 rounded-full bg-zinc-300" />
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
              {moreLinks.map((item) => (
                <li key={item.href} className="border-b border-zinc-100">
                  <Link
                    href={item.href}
                    onClick={closeMore}
                    className="flex min-h-[52px] flex-col justify-center py-3 active:bg-zinc-50"
                  >
                    <span className="font-semibold text-zinc-900">{item.label}</span>
                    <span className="text-xs text-zinc-500">{item.description}</span>
                  </Link>
                </li>
              ))}
              <li className="mt-2 border-t border-zinc-200 pt-2">
                <Link
                  href={tp("feedback")}
                  onClick={closeMore}
                  className="flex min-h-[52px] flex-col justify-center py-3 active:bg-zinc-50"
                >
                  <span className="font-semibold text-zinc-900">Feedback</span>
                  <span className="text-xs text-zinc-500">Report a problem or share a suggestion</span>
                </Link>
              </li>
            </ul>
          </Drawer.Content>
        </Drawer.Portal>
    </Drawer.Root>
  );
}
