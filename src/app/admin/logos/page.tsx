import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { LogosAdmin } from "@/components/admin/tournament/LogosAdmin";
import { can } from "@/lib/rbac/permissions";
import { getTeamsAdminList } from "@/lib/services/admin-structure";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminLogosPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const teams = await getTeamsAdminList(tournament.id);

  const teamRows = teams.map((t) => ({
    id: t.id,
    name: t.name,
    logoUrl: t.logoUrl,
    poolLabel: `${t.pool.division.name} · ${t.pool.name}`,
  }));

  const role = session?.user?.role;
  const canManage = role != null && can(role, "content:manage");

  return (
    <LogosAdmin
      tournamentLogoUrl={tournament.logoUrl}
      teams={teamRows}
      canManage={canManage}
    />
  );
}
