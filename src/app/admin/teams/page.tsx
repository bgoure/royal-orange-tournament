import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { TeamsAdmin } from "@/components/admin/structure/TeamsAdmin";
import { getTeamsAdminList, getTournamentStructure } from "@/lib/services/admin-structure";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminTeamsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

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

  return (
    <TeamsAdmin
      teams={teams}
      poolOptions={poolOptions}
      tournamentName={tournament.name}
      isAdmin={isAdmin}
    />
  );
}
