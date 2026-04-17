import { ResultsPageHeading } from "@/components/results/ResultsPageHeading";
import { GameList } from "@/components/schedule/GameList";
import { StandingsViewWithDivisionTabs } from "@/components/standings/StandingsViewWithDivisionTabs";
import { getDivisionTabCookie } from "@/lib/division-tab-cookie";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import {
  defaultDivisionTabId,
  divisionValidIds,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import { listFinalGamesForTournament } from "@/lib/services/games";
import { listPoolsWithStandings } from "@/lib/services/pools";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentSlug: string }>;
  searchParams: Promise<{ division?: string }>;
}) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  const sp = await searchParams;

  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

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

  const completedGames = await listFinalGamesForTournament(tournament.id, {
    divisionId: resolvedDivisionId,
  });

  return (
    <div className="flex flex-col gap-8">
      <ResultsPageHeading />
      <StandingsViewWithDivisionTabs
        pools={pools}
        initialResolvedDivisionId={resolvedDivisionId}
      />

      <section className="flex flex-col gap-3" aria-labelledby="completed-games-heading">
        <h2 id="completed-games-heading" className="text-lg font-semibold text-zinc-900">
          Completed games
        </h2>
        <GameList
          games={completedGames}
          timezone={tournament.timezone}
          emptyMessage="No completed games for this division yet."
          emptyHint="Finished games and scores appear here."
        />
      </section>
    </div>
  );
}
