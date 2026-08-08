import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { GamesAdmin, type AdminGameRow, type PoolWithTeams } from "@/components/admin/games/GamesAdmin";
import { formatFieldWithLocation } from "@/lib/field-display";
import { listGamesAdmin } from "@/lib/services/admin-games";
import { getTournamentStructure } from "@/lib/services/admin-structure";
import { listFieldScheduleConflicts } from "@/lib/services/schedule-conflicts";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminGamesPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; division?: string }>;
}) {
  const session = await auth();
  const tournament = await getTournamentForRequest();
  const sp = await searchParams;
  const mode = sp.mode === "scorekeeper" ? "scorekeeper" : "admin";
  const divisionParam = typeof sp.division === "string" ? sp.division : undefined;

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const [games, structure, fieldConflicts] = await Promise.all([
    listGamesAdmin(tournament.id),
    getTournamentStructure(tournament.id),
    listFieldScheduleConflicts(tournament.id),
  ]);

  if (!structure) {
    return <p className="text-sm text-zinc-500">Tournament not found.</p>;
  }

  const divisions = structure.divisions.map((d) => ({ id: d.id, name: d.name }));

  const poolsWithTeams: PoolWithTeams[] = structure.divisions.flatMap((d) =>
    d.pools.map((p) => ({
      poolId: p.id,
      label: `${d.name} → ${p.name}`,
      divisionId: d.id,
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

  const initialDivisionId =
    divisionParam && divisions.some((d) => d.id === divisionParam)
      ? divisionParam
      : divisions[0]?.id;

  return (
    <GamesAdmin
      games={games as AdminGameRow[]}
      fields={fieldRows}
      poolsWithTeams={poolsWithTeams}
      divisions={divisions}
      initialDivisionId={initialDivisionId}
      tournamentName={tournament.name}
      tournamentTimezone={tournament.timezone}
      isAdmin={isAdmin}
      mode={mode}
      fieldConflicts={fieldConflicts}
    />
  );
}
