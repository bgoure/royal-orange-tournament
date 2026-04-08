import { auth } from "@/auth";
import { AnnouncementsAdmin } from "@/components/admin/announcements/AnnouncementsAdmin";
import { can } from "@/lib/rbac/permissions";
import { listAnnouncementsForAdmin } from "@/lib/services/announcements";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminAnnouncementsPage() {
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
