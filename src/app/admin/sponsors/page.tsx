import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { TournamentSponsorsAdmin } from "@/components/admin/tournament/TournamentSponsorsAdmin";
import { can } from "@/lib/rbac/permissions";
import { listSponsorsForMarquee } from "@/lib/services/sponsors";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminSponsorsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const sponsors = await listSponsorsForMarquee(tournament.id);
  const role = session?.user?.role;
  const canManage = role != null && can(role, "content:manage");

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-zinc-900">Sponsors</h1>
      <p className="text-sm text-zinc-600">
        Manage logos for the home page marquee ({tournament.name}).
      </p>
      <TournamentSponsorsAdmin sponsors={sponsors} canManage={canManage} />
    </div>
  );
}
