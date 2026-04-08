import type { Metadata } from "next";
import { auth } from "@/auth";
import { CreateTournamentWizardRoot } from "@/components/admin/CreateTournamentWizardRoot";
import { can } from "@/lib/rbac/permissions";
import { getTournamentForRequest } from "@/lib/tournament-context";

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

  return (
    <CreateTournamentWizardRoot
      showTournamentStrip={showTournamentStrip}
      canCreateTournament={canCreateTournament}
      currentTournamentName={tournament?.name ?? null}
      currentTournamentSlug={tournament?.slug ?? null}
    >
      {children}
    </CreateTournamentWizardRoot>
  );
}
