import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { FaqAdmin } from "@/components/admin/faq/FaqAdmin";
import { can } from "@/lib/rbac/permissions";
import { listFaqItemsForAdmin } from "@/lib/services/content";
import { getTournamentForRequest } from "@/lib/tournament-context";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

export default async function AdminFaqPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const items = await listFaqItemsForAdmin(tournament.id);
  const role = session?.user?.role;
  const canManage = role != null && can(role, "content:manage");

  return (
    <FaqAdmin
      items={items}
      tournamentName={tournament.name}
      publicSitePath={tournamentPublicBasePath(tournament)}
      canManage={canManage}
    />
  );
}
