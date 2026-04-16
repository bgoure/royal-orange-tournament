import { Suspense } from "react";
import { GameList } from "@/components/schedule/GameList";
import { SchedulePullToRefresh } from "@/components/schedule/SchedulePullToRefresh";
import { ScheduleFilters } from "@/components/schedule/ScheduleFilters";
import { formatFieldWithLocation } from "@/lib/field-display";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import { getDivisionTabCookie } from "@/lib/division-tab-cookie";
import {
  divisionValidIdsWithAll,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
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

  const [teams, fields, poolRows, cookieDivision] = await Promise.all([
    listTeamsForTournament(tournament.id),
    listFieldsForTournament(tournament.id),
    listPoolsForDivisionTabs(tournament.id),
    getDivisionTabCookie(),
  ]);

  const divisionTabs = buildDivisionTabDescriptors(poolRows);
  const validIds = divisionValidIdsWithAll(divisionTabs);
  const resolvedDivisionId = resolveDivisionTabForFilters(sp.division, cookieDivision, validIds);

  const games = await listGamesForTournament(tournament.id, {
    day: sp.day,
    teamId: sp.team,
    fieldId: sp.field,
    divisionId: resolvedDivisionId,
  });

  return (
    <SchedulePullToRefresh>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Schedule &amp; Results</h1>
          <p className="text-sm text-zinc-600">
            Filter by division, day, team, or field. Final scores show when games are complete.
          </p>
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
          />
        </Suspense>
        <GameList games={games} timezone={tournament.timezone} />
      </div>
    </SchedulePullToRefresh>
  );
}
