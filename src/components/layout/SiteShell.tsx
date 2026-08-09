import type { Tournament } from "@prisma/client";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PublicQuickGameProvider } from "@/components/public-admin/PublicQuickGameProvider";
import { PublicSiteThemeRoot } from "@/components/theme/public-site-theme";
import { FavoritesProvider } from "@/hooks/useFavorites";
import { PwaInstallPrompt } from "@/components/ui/PwaInstallPrompt";
import { getDivisionTabCookie } from "@/lib/division-tab-cookie";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import { formatFieldWithLocation } from "@/lib/field-display";
import { getRequestPublicOrigin } from "@/lib/request-public-origin";
import { listFieldsForTournament, listPoolsForDivisionTabs } from "@/lib/services/pools";
import { isBracketOnlyTournament } from "@/lib/services/tournament-format";
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

  const [divisionTabDescriptors, cookieDivision, session, fieldRows, requestOrigin, bracketOnly] =
    await Promise.all([
      listPoolsForDivisionTabs(tournament.id).then(buildDivisionTabDescriptors),
      getDivisionTabCookie(),
      auth(),
      listFieldsForTournament(tournament.id),
      getRequestPublicOrigin(),
      isBracketOnlyTournament(tournament.id),
    ]);
  const showResults = !bracketOnly;
  const showRules = !bracketOnly;

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "POWER_USER";
  const quickFieldOptions = fieldRows.map((f) => ({
    id: f.id,
    label: formatFieldWithLocation(f.name, f.location.name),
  }));
  const shareUrl = requestOrigin ? `${requestOrigin}${publicBasePath}` : publicBasePath;

  return (
    <PublicSiteThemeRoot>
      <div className="flex min-h-dvh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <SiteHeader
          publicBasePath={publicBasePath}
          tournamentName={tournament.name}
          tournamentShortLabel={tournament.shortLabel}
          divisionDescriptors={divisionTabDescriptors}
          cookieDivision={cookieDivision}
          shareUrl={shareUrl}
          showResults={showResults}
          showRules={showRules}
        />
        <PwaInstallPrompt />
        <PublicQuickGameProvider
          isAdmin={isAdmin}
          showPoolScoreReset={
            session?.user?.role === "POWER_USER" || session?.user?.role === "ADMIN"
          }
          tournamentSlug={slug}
          timezone={tournament.timezone}
          fieldOptions={quickFieldOptions}
        >
          <FavoritesProvider tournamentId={tournament.id}>
            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-[7.2rem] md:pb-6">
              {children}
            </main>
          </FavoritesProvider>
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
        <BottomNav
          publicBasePath={publicBasePath}
          showPublicAnnouncements={tournament.showPublicAnnouncements}
          showResults={showResults}
          shareUrl={shareUrl}
          tournamentName={tournament.name}
        />
      </div>
    </PublicSiteThemeRoot>
  );
}

