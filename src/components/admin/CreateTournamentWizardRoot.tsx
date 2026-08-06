"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  AdminSidebar,
  type AdminSidebarTournamentOption,
} from "@/components/admin/AdminSidebar";
import { AdminTournamentStrip } from "@/components/admin/AdminTournamentStrip";
import { AdminSetupChecklistStrip } from "@/components/admin/tournament/AdminSetupChecklistStrip";
import { CreateTournamentWizardProvider } from "@/components/admin/tournament/CreateTournamentWizardContext";
import type { SetupProgress } from "@/lib/admin-setup-checklist";

type Props = {
  children: React.ReactNode;
  showTournamentStrip: boolean;
  canCreateTournament: boolean;
  currentTournamentName: string | null;
  currentTournamentSlug: string | null;
  /** Public URL for the selected tournament (`/{slug}` or archived path). */
  publicSiteHref: string;
  /** Absolute public URL for share / QR. */
  publicSiteAbsoluteUrl: string;
  setupProgress: SetupProgress | null;
  tournaments: AdminSidebarTournamentOption[];
  /** Session role — used to scope the sidebar for least-privilege roles (e.g. SCOREKEEPER). */
  staffRole?: Role | null;
};

function AdminShell({
  children,
  showTournamentStrip,
  canCreateTournament,
  currentTournamentName,
  currentTournamentSlug,
  publicSiteHref,
  publicSiteAbsoluteUrl,
  setupProgress,
  tournaments,
  staffRole,
}: Props) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const onHub = pathname === "/admin" || pathname === "/admin/";
  const isScorekeeper =
    (pathname === "/admin/games" || pathname.startsWith("/admin/games/")) &&
    searchParams.get("mode") === "scorekeeper";
  const showStrip = showTournamentStrip && !onHub && !isScorekeeper;
  const isPrintSheets = pathname.startsWith("/admin/print-sheets");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileNav();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNavOpen, closeMobileNav]);

  const mainInnerClass = isScorekeeper
    ? "mx-auto max-w-lg px-4 py-4 sm:px-6"
    : isPrintSheets
      ? "mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10 print:w-full print:max-w-none print:px-0 print:py-0.5"
      : "mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10 print:max-w-none print:px-3 print:py-2";

  return (
    <CreateTournamentWizardProvider canCreateTournament={canCreateTournament}>
      <div className="flex min-h-full bg-zinc-100 print:block print:bg-white">
        {isScorekeeper ? null : (
          <AdminSidebar
            publicSiteHref={publicSiteHref}
            currentTournamentName={currentTournamentName}
            currentTournamentSlug={currentTournamentSlug}
            tournaments={tournaments}
            mobileOpen={mobileNavOpen}
            onMobileClose={closeMobileNav}
            staffRole={staffRole}
          />
        )}
        <div className="flex min-h-full min-w-0 flex-1 flex-col print:w-full">
          {onHub && showTournamentStrip ? (
            <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3 print:hidden lg:hidden">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
                aria-label="Open navigation"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              </button>
              <span className="text-sm font-medium text-zinc-800">Tournaments</span>
            </div>
          ) : null}
          {showStrip ? (
            <div className="print:hidden">
              <AdminTournamentStrip
                publicSiteHref={publicSiteHref}
                publicSiteAbsoluteUrl={publicSiteAbsoluteUrl}
                currentTournamentSlug={currentTournamentSlug}
                currentTournamentName={currentTournamentName}
                onOpenMobileNav={() => setMobileNavOpen(true)}
              />
              {currentTournamentSlug && setupProgress ? (
                <AdminSetupChecklistStrip slug={currentTournamentSlug} progress={setupProgress} />
              ) : null}
            </div>
          ) : null}
          <main className="flex-1 bg-white print:min-h-0 print:w-full print:min-w-0 print:overflow-x-clip">
            {/* Remount page content when the selected event changes so soft nav cannot keep another tournament’s UI. */}
            <div key={currentTournamentSlug ?? "no-tournament"} className={mainInnerClass}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </CreateTournamentWizardProvider>
  );
}

function AdminShellFallback({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full bg-zinc-100">
      <main className="flex-1 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}

export function CreateTournamentWizardRoot(props: Props) {
  return (
    <Suspense fallback={<AdminShellFallback>{props.children}</AdminShellFallback>}>
      <AdminShell {...props} />
    </Suspense>
  );
}
