import { entityDivisionMatchesTab, type PoolForDivisionTabs } from "@/lib/division-tabs";
import { prisma } from "@/lib/db";

function sponsorVisibleForDivisionTab(
  assignmentDivisionIds: string[],
  tabId: string,
  poolsForTabs: PoolForDivisionTabs[],
): boolean {
  if (assignmentDivisionIds.length === 0) return true;
  if (!tabId || poolsForTabs.length === 0) return true;
  return assignmentDivisionIds.some((divisionId) =>
    entityDivisionMatchesTab(divisionId, tabId, poolsForTabs),
  );
}

/** Ordered sponsor rows for the public home marquee (metadata only), optionally scoped to the active division tab. */
export async function listSponsorsForMarquee(
  tournamentId: string,
  filter?: { divisionTabId: string; poolsForTabs: PoolForDivisionTabs[] },
) {
  const rows = await prisma.tournamentSponsor.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      updatedAt: true,
      divisionAssignments: { select: { divisionId: true } },
    },
  });

  const filtered =
    filter && filter.divisionTabId && filter.poolsForTabs.length > 0
      ? rows.filter((r) =>
          sponsorVisibleForDivisionTab(
            r.divisionAssignments.map((a) => a.divisionId),
            filter.divisionTabId,
            filter.poolsForTabs,
          ),
        )
      : rows;

  return filtered.map(({ id, updatedAt }) => ({ id, updatedAt }));
}

export async function countSponsorsForTournament(tournamentId: string) {
  return prisma.tournamentSponsor.count({ where: { tournamentId } });
}

/** Admin list including per-division visibility. */
export async function listSponsorsForAdmin(tournamentId: string) {
  return prisma.tournamentSponsor.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      updatedAt: true,
      divisionAssignments: { select: { divisionId: true } },
    },
  });
}
