import type { Metadata } from "next";
import { auth } from "@/auth";
import { CreateTournamentWizardRoot } from "@/components/admin/CreateTournamentWizardRoot";
import { can } from "@/lib/rbac/permissions";
import { getRequestPublicOrigin } from "@/lib/request-public-origin";
import { getTournamentSetupProgress } from "@/lib/services/admin-setup-progress";
import { getTournamentForRequest, listTournamentsForAdminHub } from "@/lib/tournament-context";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

/** Admin always depends on tournament cookies; never serve a stale selected-event shell. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin · Tournament Hub", template: "%s · Admin · Tournament Hub" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session?.user?.role;
  const showTournamentStrip = role === "ADMIN" || role === "POWER_USER";
  const canCreateTournament = role != null && can(role, "content:manage");
  const [tournament, hubRows, requestOrigin] = await Promise.all([
    getTournamentForRequest(),
    listTournamentsForAdminHub({
      userId: session?.user?.id,
      role: session?.user?.role,
    }),
    getRequestPublicOrigin(),
  ]);
  const setupProgress = tournament ? await getTournamentSetupProgress(tournament.id) : null;
  const publicSiteHref = tournament ? tournamentPublicBasePath(tournament) : "/";
  const publicSiteAbsoluteUrl = requestOrigin
    ? `${requestOrigin}${publicSiteHref}`
    : publicSiteHref;
  const tournaments = hubRows.map((t) => ({
    name: t.name,
    slug: t.slug,
    archivedAt: t.archivedAt ? t.archivedAt.toISOString() : null,
  }));

  return (
    <CreateTournamentWizardRoot
      showTournamentStrip={showTournamentStrip}
      canCreateTournament={canCreateTournament}
      currentTournamentName={tournament?.name ?? null}
      currentTournamentSlug={tournament?.slug ?? null}
      publicSiteHref={publicSiteHref}
      publicSiteAbsoluteUrl={publicSiteAbsoluteUrl}
      setupProgress={setupProgress}
      tournaments={tournaments}
      staffRole={role ?? null}
    >
      {children}
    </CreateTournamentWizardRoot>
  );
}
