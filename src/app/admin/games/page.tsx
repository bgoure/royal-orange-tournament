import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { GamesAdmin, type AdminGameRow, type PoolWithTeams } from "@/components/admin/games/GamesAdmin";
import { formatFieldWithLocation } from "@/lib/field-display";
import { listGamesAdmin } from "@/lib/services/admin-games";
import { getTournamentStructure } from "@/lib/services/admin-structure";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminGamesPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const [games, structure] = await Promise.all([
    listGamesAdmin(tournament.id),
    getTournamentStructure(tournament.id),
  ]);

  if (!structure) {
    return <p className="text-sm text-zinc-500">Tournament not found.</p>;
  }

  const poolsWithTeams: PoolWithTeams[] = structure.divisions.flatMap((d) =>
    d.pools.map((p) => ({
      poolId: p.id,
      label: `${d.name} → ${p.name}`,
      teams: p.teams.map((t) => ({
        id: t.id,
        name: t.name,
      })),
    })),
  );

  const fieldRows = structure.fields.map((f) => ({
    id: f.id,
    label: formatFieldWithLocation(f.name, f.location.name),
  }));
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <GamesAdmin
      games={games as AdminGameRow[]}
      fields={fieldRows}
      poolsWithTeams={poolsWithTeams}
      tournamentName={tournament.name}
      isAdmin={isAdmin}
    />
  );
}
