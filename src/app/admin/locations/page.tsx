import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { VenuesAdmin } from "@/components/admin/venues/VenuesAdmin";
import { can } from "@/lib/rbac/permissions";
import { listLocations } from "@/lib/services/content";
import { loadAdminPageTournament } from "@/lib/rbac/tenant-access";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

export default async function AdminLocationsPage() {
  const { session, tournament } = await loadAdminPageTournament();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const locations = await listLocations(tournament.id);
  const role = session?.user?.role;
  const canManage = role != null && can(role, "content:manage");

  return (
    <VenuesAdmin
      locations={locations}
      tournamentName={tournament.name}
      publicSitePath={tournamentPublicBasePath(tournament)}
      canManage={canManage}
    />
  );
}
