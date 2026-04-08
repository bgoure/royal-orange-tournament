import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { AnnouncementsAdmin } from "@/components/admin/announcements/AnnouncementsAdmin";
import { can } from "@/lib/rbac/permissions";
import { listAnnouncementsForAdmin } from "@/lib/services/announcements";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminAnnouncementsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const items = await listAnnouncementsForAdmin(tournament.id);
  const role = session?.user?.role;
  const canManage =
    role != null &&
    (can(role, "announcement:create") ||
      can(role, "announcement:update") ||
      can(role, "announcement:delete"));

  return (
    <AnnouncementsAdmin items={items} tournamentName={tournament.name} canManage={canManage} />
  );
}
