import { auth } from "@/auth";
import { FieldsAdmin } from "@/components/admin/fields/FieldsAdmin";
import { can } from "@/lib/rbac/permissions";
import { listLocationsWithFields } from "@/lib/services/content";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminFieldsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
        <h1 className="text-lg font-semibold text-amber-900">No tournament selected</h1>
        <p className="mt-2 text-sm text-amber-800">
          Open the public site, choose a tournament from the switcher, then return here.
        </p>
      </div>
    );
  }

  const groups = await listLocationsWithFields(tournament.id);
  const role = session?.user?.role;
  const canManage = role != null && can(role, "content:manage");

  return <FieldsAdmin groups={groups} tournamentName={tournament.name} canManage={canManage} />;
}
