import type { Tournament } from "@prisma/client";
import { DivisionSwipeBoundary } from "@/components/layout/DivisionSwipeBoundary";
import { ResultsPageHeading } from "@/components/results/ResultsPageHeading";
import { GameList } from "@/components/schedule/GameList";
import { ScheduleFilters } from "@/components/schedule/ScheduleFilters";
import { StandingsViewWithDivisionTabs } from "@/components/standings/StandingsViewWithDivisionTabs";
import { SectionTitle } from "@/components/ui/PublicHeading";
import { getDivisionTabCookie } from "@/lib/division-tab-cookie";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import {
  defaultDivisionTabId,
  divisionValidIds,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import {
  listFinalGamesFilterFacets,
  listFinalGamesForTournament,
} from "@/lib/services/games";
import {
  listFieldsForTournament,
  listPoolsWithStandings,
  listTeamsForTournament,
} from "@/lib/services/pools";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

export async function TournamentResultsPublic({
  tournament,
  searchParams,
}: {
  tournament: Tournament;
  searchParams: { day?: string; team?: string; field?: string; division?: string };
}) {
  const publicBasePath = tournamentPublicBasePath(tournament);
  const sp = searchParams;

  const pools = await listPoolsWithStandings(tournament.id);

  const minimal = pools.map((p) => ({
    id: p.id,
    name: p.name,
    division: p.division,
  }));
  const divisionDescriptors = buildDivisionTabDescriptors(minimal);
  const cookieDivision = await getDivisionTabCookie();
  const validDivisionIds = divisionValidIds(divisionDescriptors);
  const resolvedDivisionId = resolveDivisionTabForFilters(
    sp.division,
    cookieDivision,
    validDivisionIds,
    defaultDivisionTabId(divisionDescriptors),
  );

  const [teams, fields, { dayOptions, teamIds, fieldIds }] = await Promise.all([
    listTeamsForTournament(tournament.id),
    listFieldsForTournament(tournament.id),
    listFinalGamesFilterFacets(tournament.id, resolvedDivisionId, tournament.timezone),
  ]);

  const dayFilter = sp.day && dayOptions.some((d) => d.value === sp.day) ? sp.day : undefined;
  const teamFilter = sp.team && teamIds.has(sp.team) ? sp.team : undefined;
  const fieldFilter = sp.field && fieldIds.has(sp.field) ? sp.field : undefined;

  const completedGames = await listFinalGamesForTournament(tournament.id, {
    divisionId: resolvedDivisionId,
    day: dayFilter,
    teamId: teamFilter,
    fieldId: fieldFilter,
  });

  const filterTeams = teams
    .filter((t) => teamIds.has(t.id))
    .map((t) => ({ id: t.id, name: t.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filterFields = fields
    .filter((f) => fieldIds.has(f.id))
    .map((f) => ({
      id: f.id,
      label: f.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <PullToRefresh>
      <DivisionSwipeBoundary
        publicBasePath={publicBasePath}
        divisionIdsOrdered={divisionDescriptors.map((d) => d.id)}
        defaultDivisionId={defaultDivisionTabId(divisionDescriptors)}
      >
        <div className="flex flex-col gap-4">
          <ResultsPageHeading />
          <StandingsViewWithDivisionTabs
            pools={pools}
            initialResolvedDivisionId={resolvedDivisionId}
          />

          <section className="flex flex-col gap-3" aria-labelledby="completed-games-heading">
            <SectionTitle id="completed-games-heading">Completed games</SectionTitle>
            <ScheduleFilters
              publicBasePath={publicBasePath}
              dayOptions={dayOptions}
              teams={filterTeams}
              fields={filterFields}
              pathSegment="results"
              filtersAriaLabel="Filter completed games"
            />
            <GameList
              games={completedGames}
              timezone={tournament.timezone}
              emptyMessage="No completed games for this division yet."
              emptyHint="Try another filter, or finished games will appear here as divisions play."
            />
          </section>
        </div>
      </DivisionSwipeBoundary>
    </PullToRefresh>
  );
}
