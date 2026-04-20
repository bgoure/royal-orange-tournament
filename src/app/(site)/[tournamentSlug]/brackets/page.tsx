import { DivisionSwipeBoundary } from "@/components/layout/DivisionSwipeBoundary";
import { BracketsViewWithDivisionTabs } from "@/components/brackets/BracketsViewWithDivisionTabs";
import { getDivisionTabCookie } from "@/lib/division-tab-cookie";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import {
  defaultDivisionTabId,
  divisionValidIds,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import { listBracketsForTournament, listConsolationGamesForTournament } from "@/lib/services/brackets";
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

  const [brackets, poolsForTabs, consolationGames] = await Promise.all([
    listBracketsForTournament(tournament.id, { publishedOnly: true }),
    listPoolsForDivisionTabs(tournament.id),
    listConsolationGamesForTournament(tournament.id, { publishedOnly: true }),
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
    <DivisionSwipeBoundary
      tournamentSlug={tournamentSlug}
      divisionIdsOrdered={divisionDescriptors.map((d) => d.id)}
      defaultDivisionId={defaultDivisionTabId(divisionDescriptors)}
    >
      <div className="flex flex-col gap-4">
        <BracketsViewWithDivisionTabs
          poolsForTabs={poolsForTabs}
          brackets={brackets}
          consolationGames={consolationGames}
          initialResolvedDivisionId={resolvedDivisionId}
          tournamentTimezone={tournament.timezone}
        />
      </div>
    </DivisionSwipeBoundary>
  );
}
