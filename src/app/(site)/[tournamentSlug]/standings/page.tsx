import { Suspense } from "react";
import { StandingsViewWithDivisionTabs } from "@/components/standings/StandingsViewWithDivisionTabs";
import { getDivisionTabCookie } from "@/lib/division-tab-cookie";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import {
  defaultDivisionTabId,
  divisionValidIds,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import { listPoolsWithStandings } from "@/lib/services/pools";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";

export default async function StandingsPage({
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Standings</h1>
        <p className="text-sm text-zinc-600">
          Points: 2 win, 1 tie, 0 loss. Tiebreakers follow published pool rules.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-xl bg-zinc-100/80" aria-hidden="true" />
        }
      >
        <StandingsViewWithDivisionTabs
          pools={pools}
          initialResolvedDivisionId={resolvedDivisionId}
        />
      </Suspense>
    </div>
  );
}
