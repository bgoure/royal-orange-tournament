import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { FieldsAdmin } from "@/components/admin/fields/FieldsAdmin";
import { can } from "@/lib/rbac/permissions";
import { listLocationsWithFields } from "@/lib/services/content";
import { loadAdminPageTournament } from "@/lib/rbac/tenant-access";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

export default async function AdminFieldsPage() {
  const { session, tournament } = await loadAdminPageTournament();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const groups = await listLocationsWithFields(tournament.id);
  const role = session?.user?.role;
  const canManage = role != null && can(role, "content:manage");

  return (
    <FieldsAdmin
      groups={groups}
      tournamentName={tournament.name}
      publicSitePath={tournamentPublicBasePath(tournament)}
      canManage={canManage}
    />
  );
}
