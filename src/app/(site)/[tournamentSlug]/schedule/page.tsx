import { Suspense } from "react";
import { GameList } from "@/components/schedule/GameList";
import { SchedulePullToRefresh } from "@/components/schedule/SchedulePullToRefresh";
import { ScheduleFilters } from "@/components/schedule/ScheduleFilters";
import { formatFieldWithLocation } from "@/lib/field-display";
import { getDivisionTabCookie } from "@/lib/division-tab-cookie";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import {
  defaultDivisionTabId,
  divisionValidIds,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import { listFieldsForTournament, listPoolsForDivisionTabs, listTeamsForTournament } from "@/lib/services/pools";
import { listGamesForTournament, listScheduleFilterFacets } from "@/lib/services/games";
import { PageTitle } from "@/components/ui/PublicHeading";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentSlug: string }>;
  searchParams: Promise<{ day?: string; team?: string; field?: string; division?: string }>;
}) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  const sp = await searchParams;

  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  const [teams, fields, poolRows] = await Promise.all([
    listTeamsForTournament(tournament.id),
    listFieldsForTournament(tournament.id),
    listPoolsForDivisionTabs(tournament.id),
  ]);

  const divisionTabs = buildDivisionTabDescriptors(poolRows);
  const cookieDivision = await getDivisionTabCookie();
  const validIds = divisionValidIds(divisionTabs);
  const resolvedDivisionId = resolveDivisionTabForFilters(
    sp.division,
    cookieDivision,
    validIds,
    defaultDivisionTabId(divisionTabs),
  );

  const { dayOptions, teamIds, fieldIds } = await listScheduleFilterFacets(
    tournament.id,
    resolvedDivisionId,
    tournament.timezone,
  );

  const dayFilter =
    sp.day && dayOptions.some((d) => d.value === sp.day) ? sp.day : undefined;
  const teamFilter = sp.team && teamIds.has(sp.team) ? sp.team : undefined;
  const fieldFilter = sp.field && fieldIds.has(sp.field) ? sp.field : undefined;

  const games = await listGamesForTournament(tournament.id, {
    day: dayFilter,
    teamId: teamFilter,
    fieldId: fieldFilter,
    divisionId: resolvedDivisionId,
  });

  const filterTeams = teams
    .filter((t) => teamIds.has(t.id))
    .map((t) => ({ id: t.id, name: t.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filterFields = fields
    .filter((f) => fieldIds.has(f.id))
    .map((f) => ({
      id: f.id,
      label: formatFieldWithLocation(f.name, f.location.name),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <SchedulePullToRefresh>
      <div className="flex flex-col gap-4">
        <PageTitle>Schedule</PageTitle>
        <Suspense
          fallback={<div className="h-24 animate-pulse rounded-xl bg-zinc-100" aria-hidden />}
        >
          <ScheduleFilters
            tournamentSlug={tournamentSlug}
            dayOptions={dayOptions}
            teams={filterTeams}
            fields={filterFields}
          />
        </Suspense>
        <GameList games={games} timezone={tournament.timezone} showScores={false} />
      </div>
    </SchedulePullToRefresh>
  );
}
