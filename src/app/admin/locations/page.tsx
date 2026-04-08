import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { VenuesAdmin } from "@/components/admin/venues/VenuesAdmin";
import { can } from "@/lib/rbac/permissions";
import { listLocations } from "@/lib/services/content";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminLocationsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const locations = await listLocations(tournament.id);
  const role = session?.user?.role;
  const canManage = role != null && can(role, "content:manage");

  return <VenuesAdmin locations={locations} tournamentName={tournament.name} canManage={canManage} />;
}
