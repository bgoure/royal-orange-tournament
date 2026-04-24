import type { Tournament } from "@prisma/client";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PublicQuickGameProvider } from "@/components/public-admin/PublicQuickGameProvider";
import { PublicSiteThemeRoot } from "@/components/theme/public-site-theme";
import { PwaInstallPrompt } from "@/components/ui/PwaInstallPrompt";
import { getDivisionTabCookie } from "@/lib/division-tab-cookie";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import { formatFieldWithLocation } from "@/lib/field-display";
import { listFieldsForTournament, listPoolsForDivisionTabs } from "@/lib/services/pools";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

function deployShaLabel(): string {
  const full =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
    "";
  if (!full) return "local";
  return full.slice(0, 7);
}

export async function SiteShell({
  children,
  tournament,
}: {
  children: React.ReactNode;
  tournament: Tournament;
}) {
  const sha = deployShaLabel();
  const slug = tournament.slug;
  const publicBasePath = tournamentPublicBasePath(tournament);

  const [divisionTabDescriptors, cookieDivision, session, fieldRows] = await Promise.all([
    listPoolsForDivisionTabs(tournament.id).then(buildDivisionTabDescriptors),
    getDivisionTabCookie(),
    auth(),
    listFieldsForTournament(tournament.id),
  ]);

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "POWER_USER";
  const quickFieldOptions = fieldRows.map((f) => ({
    id: f.id,
    label: formatFieldWithLocation(f.name, f.location.name),
  }));

  return (
    <PublicSiteThemeRoot>
      <div className="flex min-h-dvh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <SiteHeader
          tournamentSlug={slug}
          publicBasePath={publicBasePath}
          divisionTabDescriptors={divisionTabDescriptors}
          cookieDivision={cookieDivision}
        />
        <PwaInstallPrompt />
        <PublicQuickGameProvider
          isAdmin={isAdmin}
          tournamentSlug={slug}
          timezone={tournament.timezone}
          fieldOptions={quickFieldOptions}
        >
          <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-[7.2rem] md:pb-6">
            {children}
          </main>
        </PublicQuickGameProvider>
        <footer className="hidden border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 md:block">
          Royal &amp; Orange 2026 — schedules, scores, and brackets
          <span className="mt-2 block font-mono text-[10px] text-zinc-400 dark:text-zinc-500">Deploy {sha}</span>
        </footer>
        <p
          className="border-t border-zinc-200/80 bg-zinc-50/80 py-2 text-center font-mono text-[10px] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-500 md:hidden"
          title="Git commit for this deployment"
        >
          Deploy {sha}
        </p>
        <BottomNav publicBasePath={publicBasePath} showPublicAnnouncements={tournament.showPublicAnnouncements} />
      </div>
    </PublicSiteThemeRoot>
  );
}

