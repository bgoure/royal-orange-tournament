import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { TeamsAdmin } from "@/components/admin/structure/TeamsAdmin";
import { getTeamsAdminList, getTournamentStructure } from "@/lib/services/admin-structure";
import { loadAdminPageTournament } from "@/lib/rbac/tenant-access";
import { can } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  const { session, tournament } = await loadAdminPageTournament();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const [teams, structure] = await Promise.all([
    getTeamsAdminList(tournament.id),
    getTournamentStructure(tournament.id),
  ]);

  if (!structure) {
    return <p className="text-sm text-zinc-500">Tournament not found.</p>;
  }

  const poolOptions = structure.divisions.flatMap((d) =>
    d.pools.map((p) => ({
      poolId: p.id,
      divisionId: d.id,
      label: `${d.name} → ${p.name}`,
    })),
  );

  const isAdmin = session?.user?.role === "ADMIN";
  const canAssignPools = session?.user?.role ? can(session.user.role, "team:update") : false;

  const assignmentDivisions = structure.divisions.map((d) => ({
    id: d.id,
    name: d.name,
    pools: d.pools.map((p) => ({ id: p.id, name: p.name, sortOrder: p.sortOrder })),
    teams: d.pools.flatMap((p) => p.teams.map((t) => ({ id: t.id, name: t.name, poolId: p.id }))),
    publishedBracket: d.brackets.some((b) => b.published),
  }));

  return (
    <TeamsAdmin
      key={tournament.id}
      teams={teams}
      poolOptions={poolOptions}
      assignmentDivisions={assignmentDivisions}
      tournamentName={tournament.name}
      isAdmin={isAdmin}
      canAssignPools={canAssignPools}
    />
  );
}
