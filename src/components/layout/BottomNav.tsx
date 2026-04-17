"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tournamentPath } from "@/lib/tournament-public-path";

export function BottomNav({ tournamentSlug }: { tournamentSlug: string }) {
  const pathname = usePathname();
  const tp = (...s: string[]) => tournamentPath(tournamentSlug, ...s);

  const tabs = [
    {
      key: "home" as const,
      href: tp(),
      label: "Home",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5">
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
        </svg>
      ),
    },
    {
      key: "schedule" as const,
      href: tp("schedule"),
      label: "Schedule",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5">
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5">
          <path d="M8 21V16M12 21V10M16 21V4" />
        </svg>
      ),
    },
    {
      key: "brackets" as const,
      href: tp("brackets"),
      label: "Brackets",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5">
          <path d="M4 4v6h4M4 7h4M20 4v6h-4M20 7h-4M4 20v-6h4M4 17h4M20 20v-6h-4M20 17h-4M8 7h2a2 2 0 012 2v6a2 2 0 01-2 2H8M16 7h-2a2 2 0 00-2 2v6a2 2 0 002 2h2" />
        </svg>
      ),
    },
    {
      key: "more" as const,
      href: tp("more"),
      label: "More",
      matchPrefixes: [tp("faq"), tp("locations"), tp("more"), tp("settings"), tp("social")],
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5">
          <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
        </svg>
      ),
    },
  ] as const;

  const parts = pathname.split("/").filter(Boolean);
  const firstSeg = parts[0] ?? "";
  const secondSeg = parts[1] ?? "";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200/80 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2">
        {tabs.map((t) => {
          let active = false;
          if (firstSeg !== tournamentSlug) {
            active = false;
          } else if (t.key === "home") {
            active = secondSeg === "";
          } else if (t.key === "more") {
            active =
              "matchPrefixes" in t &&
              t.matchPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
          } else {
            active = secondSeg === t.key;
          }
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex min-h-[52px] min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-medium transition-colors active:scale-[0.98] ${
                active
                  ? "text-royal"
                  : "text-zinc-400 active:text-zinc-600"
              }`}
            >
              <span className={active ? "text-royal" : "text-zinc-400"}>{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
