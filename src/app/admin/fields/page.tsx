import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { FieldsAdmin } from "@/components/admin/fields/FieldsAdmin";
import { can } from "@/lib/rbac/permissions";
import { listLocationsWithFields } from "@/lib/services/content";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminFieldsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const groups = await listLocationsWithFields(tournament.id);
  const role = session?.user?.role;
  const canManage = role != null && can(role, "content:manage");

  return <FieldsAdmin groups={groups} tournamentName={tournament.name} canManage={canManage} />;
}
