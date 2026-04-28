import { auth } from "@/auth";
import { UsersAdmin } from "@/components/admin/users/UsersAdmin";
import { can } from "@/lib/rbac/permissions";
import { listUsersForAdmin } from "@/lib/services/users-admin";
import { getTournamentForRequest } from "@/lib/tournament-context";
import { prisma } from "@/lib/db";

export default async function AdminUsersPage() {
  const session = await auth();
  const role = session?.user?.role;

  const canView = role != null && can(role, "user:read");
  if (!canView) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-8 text-center">
        <h1 className="text-lg font-semibold text-zinc-900">Restricted</h1>
        <p className="mt-2 text-sm text-zinc-600">Only administrators can view user management.</p>
      </div>
    );
  }

  const tournament = await getTournamentForRequest();
  const [users, divisions] = await Promise.all([
    listUsersForAdmin(),
    tournament
      ? prisma.division.findMany({
          where: { tournamentId: tournament.id },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const canManage = can(role, "user:manageRoles");
  const actorId = session?.user?.id ?? "";

  return (
    <UsersAdmin
      users={users}
      actorUserId={actorId}
      canManage={canManage}
      divisionOptions={divisions}
    />
  );
}
