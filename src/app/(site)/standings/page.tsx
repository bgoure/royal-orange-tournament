import { Suspense } from "react";
import { StandingsViewWithDivisionTabs } from "@/components/standings/StandingsViewWithDivisionTabs";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import {
  divisionValidIdsStandingsOnly,
  getDivisionTabCookie,
  resolveDivisionTabForStandings,
} from "@/lib/division-tab-cookie";
import { listPoolsWithStandings } from "@/lib/services/pools";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string }>;
}) {
  const tournament = await getTournamentForRequest();
  const sp = await searchParams;

  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  const [pools, cookieDivision] = await Promise.all([
    listPoolsWithStandings(tournament.id),
    getDivisionTabCookie(),
  ]);

  const minimal = pools.map((p) => ({
    id: p.id,
    name: p.name,
    division: p.division,
  }));
  const divisionDescriptors = buildDivisionTabDescriptors(minimal);
  const validIds = divisionValidIdsStandingsOnly(divisionDescriptors);
  const firstTabId = divisionDescriptors[0]?.id ?? "";
  const resolvedDivisionId =
    divisionDescriptors.length > 1
      ? resolveDivisionTabForStandings(sp.division, cookieDivision, validIds, firstTabId)
      : firstTabId;

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
