import type { Tournament } from "@prisma/client";
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
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

export async function TournamentBracketsPublic({
  tournament,
  searchParams,
}: {
  tournament: Tournament;
  searchParams: { division?: string };
}) {
  const publicBasePath = tournamentPublicBasePath(tournament);
  const sp = searchParams;

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
      publicBasePath={publicBasePath}
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
