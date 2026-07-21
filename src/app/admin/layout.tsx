import type { Metadata } from "next";
import { auth } from "@/auth";
import { CreateTournamentWizardRoot } from "@/components/admin/CreateTournamentWizardRoot";
import { can } from "@/lib/rbac/permissions";
import { getTournamentSetupProgress } from "@/lib/services/admin-setup-progress";
import { getTournamentForRequest } from "@/lib/tournament-context";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

export const metadata: Metadata = {
  title: { default: "Admin · Tournament Hub", template: "%s · Admin · Tournament Hub" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session?.user?.role;
  const showTournamentStrip = role === "ADMIN" || role === "POWER_USER";
  const canCreateTournament = role != null && can(role, "content:manage");
  const tournament = await getTournamentForRequest();
  const setupProgress = tournament ? await getTournamentSetupProgress(tournament.id) : null;
  const publicSiteHref = tournament ? tournamentPublicBasePath(tournament) : "/";

  return (
    <CreateTournamentWizardRoot
      showTournamentStrip={showTournamentStrip}
      canCreateTournament={canCreateTournament}
      currentTournamentName={tournament?.name ?? null}
      currentTournamentSlug={tournament?.slug ?? null}
      publicSiteHref={publicSiteHref}
      setupProgress={setupProgress}
    >
      {children}
    </CreateTournamentWizardRoot>
  );
}
