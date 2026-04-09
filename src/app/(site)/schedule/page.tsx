import { Suspense } from "react";
import { GameList } from "@/components/schedule/GameList";
import { ScheduleFilters } from "@/components/schedule/ScheduleFilters";
import { formatFieldWithLocation } from "@/lib/field-display";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import { listFieldsForTournament, listPoolsForDivisionTabs, listTeamsForTournament } from "@/lib/services/pools";
import { listGamesForTournament } from "@/lib/services/games";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; team?: string; field?: string; division?: string }>;
}) {
  const tournament = await getTournamentForRequest();
  const sp = await searchParams;

  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  const [teams, fields, games, poolRows] = await Promise.all([
    listTeamsForTournament(tournament.id),
    listFieldsForTournament(tournament.id),
    listGamesForTournament(tournament.id, {
      day: sp.day,
      teamId: sp.team,
      fieldId: sp.field,
      divisionId: sp.division,
    }),
    listPoolsForDivisionTabs(tournament.id),
  ]);

  const divisionTabs = buildDivisionTabDescriptors(poolRows);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Schedule</h1>
        <p className="text-sm text-zinc-600">Filter by division, day, team, or field.</p>
      </div>
      <Suspense
        fallback={<div className="h-24 animate-pulse rounded-xl bg-zinc-100" aria-hidden />}
      >
        <ScheduleFilters
          teams={teams.map((t) => ({
            id: t.id,
            name: t.name,
          }))}
          fields={fields.map((f) => ({
            id: f.id,
            label: formatFieldWithLocation(f.name, f.location.name),
          }))}
          timezone={tournament.timezone}
          divisionTabs={divisionTabs}
        />
      </Suspense>
      <GameList games={games} />
    </div>
  );
}
