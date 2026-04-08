import { auth } from "@/auth";
import { UsersAdmin } from "@/components/admin/users/UsersAdmin";
import { can } from "@/lib/rbac/permissions";
import { listUsersForAdmin } from "@/lib/services/users-admin";

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

  const users = await listUsersForAdmin();
  const canManage = can(role, "user:manageRoles");
  const actorId = session?.user?.id ?? "";

  return <UsersAdmin users={users} actorUserId={actorId} canManage={canManage} />;
}
