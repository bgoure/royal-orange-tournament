"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { adminNavGroups, navItemIsActive } from "@/components/admin/admin-nav";
import { useCreateTournamentWizard } from "@/components/admin/tournament/CreateTournamentWizardContext";
import { adminTournamentSelectHref } from "@/lib/admin-tournament-href";
import type { Role } from "@prisma/client";

export type AdminSidebarTournamentOption = {
  name: string;
  slug: string;
  archivedAt: string | null;
};

type Props = {
  publicSiteHref: string;
  currentTournamentName: string | null;
  currentTournamentSlug: string | null;
  tournaments: AdminSidebarTournamentOption[];
  /** When true, drawer is open on small screens (controlled by shell). */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  staffRole?: Role | null;
};

function selectHref(slug: string, nextPath: string): string {
  return adminTournamentSelectHref(slug, nextPath);
}

function SidebarPanel({
  publicSiteHref,
  currentTournamentName,
  currentTournamentSlug,
  tournaments,
  onNavigate,
  staffRole,
}: {
  publicSiteHref: string;
  currentTournamentName: string | null;
  currentTournamentSlug: string | null;
  tournaments: AdminSidebarTournamentOption[];
  onNavigate?: () => void;
  staffRole?: Role | null;
}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const { open: openWizard, canCreateTournament } = useCreateTournamentWizard();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const currentMeta = tournaments.find((t) => t.slug === currentTournamentSlug);

  useEffect(() => {
    if (!switcherOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!switcherRef.current?.contains(e.target as Node)) setSwitcherOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSwitcherOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [switcherOpen]);

  const nextForSelect =
    pathname.startsWith("/admin") && pathname !== "/admin" && pathname !== "/admin/"
      ? pathname
      : "/admin/tournament-settings";

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-zinc-700/80 px-3 py-4">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Tournament Hub
        </p>
        <div className="relative mt-2" ref={switcherRef}>
          <button
            type="button"
            aria-expanded={switcherOpen}
            aria-controls={listId}
            onClick={() => setSwitcherOpen((o) => !o)}
            className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-zinc-800/80"
          >
            <div className="min-w-0 flex-1">
              {currentTournamentName && currentTournamentSlug ? (
                <>
                  <p className="truncate text-sm font-semibold text-white">{currentTournamentName}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                    <span
                      className={`inline-flex rounded-full px-1.5 py-0.5 font-medium ${
                        currentMeta?.archivedAt
                          ? "bg-amber-500/20 text-amber-200"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {currentMeta?.archivedAt ? "Archived" : "Live"}
                    </span>
                    <span className="truncate font-mono text-zinc-500">{publicSiteHref}</span>
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-amber-200">No tournament selected</p>
              )}
            </div>
            <span className="mt-1 shrink-0 text-zinc-400" aria-hidden>
              ▾
            </span>
          </button>
          {switcherOpen ? (
            <div
              id={listId}
              className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
              role="listbox"
            >
              {tournaments.map((t) => {
                const active = t.slug === currentTournamentSlug;
                return (
                  <Link
                    key={t.slug}
                    href={selectHref(t.slug, nextForSelect)}
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setSwitcherOpen(false);
                      onNavigate?.();
                    }}
                    className={`block px-3 py-2 text-sm hover:bg-zinc-800 ${
                      active ? "bg-zinc-800 text-white" : "text-zinc-300"
                    }`}
                  >
                    <span className="block truncate font-medium">{t.name}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-zinc-500">/{t.slug}</span>
                  </Link>
                );
              })}
              <div className="my-1 border-t border-zinc-700" />
              <Link
                href="/admin"
                onClick={() => {
                  setSwitcherOpen(false);
                  onNavigate?.();
                }}
                className="block px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                All tournaments
              </Link>
              {canCreateTournament ? (
                <button
                  type="button"
                  onClick={() => {
                    setSwitcherOpen(false);
                    openWizard();
                    onNavigate?.();
                  }}
                  className="block w-full px-3 py-2 text-left text-sm font-medium text-emerald-400 hover:bg-zinc-800"
                >
                  + Create tournament
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3" aria-label="Admin">
        {(staffRole === "SCOREKEEPER"
          ? adminNavGroups
              .filter((g) => g.id === "ops")
              .map((g) => ({
                ...g,
                items: g.items.filter((i) => i.segment === "games-scorekeeper"),
              }))
          : adminNavGroups
        ).map((group) => (
          <div key={group.id}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = navItemIsActive(pathname, item.href, item.segment, search);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onNavigate?.()}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-zinc-700/80 p-3">
        <Link
          href={publicSiteHref}
          onClick={() => onNavigate?.()}
          className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
          title={publicSiteHref}
        >
          ← Public site
        </Link>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: publicSiteHref })}
          className="rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-500 transition-colors hover:bg-red-900/30 hover:text-red-300"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AdminSidebar({
  publicSiteHref,
  currentTournamentName,
  currentTournamentSlug,
  tournaments,
  mobileOpen = false,
  onMobileClose,
  staffRole = null,
}: Props) {
  const pathname = usePathname() ?? "";

  useEffect(() => {
    onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close on route change only
  }, [pathname]);

  const asideClass =
    "flex h-full w-60 shrink-0 flex-col border-r border-zinc-700/80 bg-zinc-900 text-zinc-100";

  const panelProps = {
    publicSiteHref,
    currentTournamentName,
    currentTournamentSlug,
    tournaments,
    staffRole,
  };

  return (
    <>
      <aside className={`hidden lg:flex ${asideClass} print:hidden`}>
        <SidebarPanel {...panelProps} />
      </aside>

      <div
        className={`fixed inset-0 z-50 lg:hidden print:hidden ${mobileOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/50 transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          aria-label="Close navigation"
          onClick={() => onMobileClose?.()}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex ${asideClass} shadow-2xl transition-transform duration-200 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarPanel {...panelProps} onNavigate={onMobileClose} />
        </aside>
      </div>
    </>
  );
}
