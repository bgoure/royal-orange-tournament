import { Suspense } from "react";
import { BracketsViewWithDivisionTabs } from "@/components/brackets/BracketsViewWithDivisionTabs";
import { getDivisionTabCookie } from "@/lib/division-tab-cookie";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import {
  defaultDivisionTabId,
  divisionValidIds,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import { listBracketsForTournament } from "@/lib/services/brackets";
import { listPoolsForDivisionTabs } from "@/lib/services/pools";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";

export default async function BracketsPage({
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

  const [brackets, poolsForTabs] = await Promise.all([
    listBracketsForTournament(tournament.id),
    listPoolsForDivisionTabs(tournament.id),
  ]);

  const divisionDescriptors = buildDivisionTabDescriptors(poolsForTabs);
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
        <h1 className="text-2xl font-semibold text-zinc-900">Brackets</h1>
        <p className="text-sm text-zinc-600">Playoff rounds and scheduled games.</p>
      </div>
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-xl bg-zinc-100/80" aria-hidden="true" />
        }
      >
        <BracketsViewWithDivisionTabs
          poolsForTabs={poolsForTabs}
          brackets={brackets}
          initialResolvedDivisionId={resolvedDivisionId}
          tournamentTimezone={tournament.timezone}
        />
      </Suspense>
    </div>
  );
}
