import { auth } from "@/auth";
import { GamesAdmin, type AdminGameRow, type PoolWithTeams } from "@/components/admin/games/GamesAdmin";
import { formatFieldWithLocation } from "@/lib/field-display";
import { listGamesAdmin } from "@/lib/services/admin-games";
import { getTournamentStructure } from "@/lib/services/admin-structure";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminGamesPage() {
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
        abbreviation: t.abbreviation,
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
