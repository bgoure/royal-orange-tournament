import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { bracketUsesPoolSeeding } from "@/lib/services/admin-brackets";
import { countIncompleteDivisionPoolGames, countTotalDivisionPoolGames } from "@/lib/services/round-robin-division";
import { getUserAssignedDivisionIds } from "@/lib/services/users-admin";

export type BracketProgressForPublicSettings = {
  bracketId: string;
  bracketName: string;
  divisionId: string;
  divisionName: string;
  poolGamesTotal: number;
  poolGamesIncomplete: number;
  needsResolutionRefresh: boolean;
  usesPoolSeeding: boolean;
};

/**
 * Playoff brackets the user may push/reset from the public settings page: all divisions for ADMIN,
 * assigned divisions in this tournament for POWER_USER with `bracket:pushAndReset`.
 */
export async function listBracketProgressForPublicSettings(
  tournamentId: string,
  userId: string,
  role: Role,
): Promise<BracketProgressForPublicSettings[]> {
  const allowed =
    (role === "ADMIN" && can(role, "bracket:configure")) ||
    (role === "POWER_USER" && can(role, "bracket:pushAndReset"));
  if (!allowed) return [];

  let divisionIds: string[];
  if (role === "ADMIN") {
    const divs = await prisma.division.findMany({
      where: { tournamentId },
      select: { id: true },
      orderBy: { sortOrder: "asc" },
    });
    divisionIds = divs.map((d) => d.id);
  } else {
    const assigned = await getUserAssignedDivisionIds(userId);
    const inTournament = await prisma.division.findMany({
      where: { tournamentId, id: { in: [...assigned] } },
      select: { id: true },
      orderBy: { sortOrder: "asc" },
    });
    divisionIds = inTournament.map((d) => d.id);
  }

  if (divisionIds.length === 0) return [];

  const brackets = await prisma.bracket.findMany({
    where: { tournamentId, divisionId: { in: divisionIds } },
    orderBy: [{ division: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      needsResolutionRefresh: true,
      division: { select: { id: true, name: true } },
    },
  });

  const enriched = await Promise.all(
    brackets.map(async (b) => {
      const [poolGamesTotal, poolGamesIncomplete, usesPoolSeeding] = await Promise.all([
        countTotalDivisionPoolGames(tournamentId, b.division.id),
        countIncompleteDivisionPoolGames(tournamentId, b.division.id),
        bracketUsesPoolSeeding(b.id),
      ]);
      return {
        bracketId: b.id,
        bracketName: b.name,
        divisionId: b.division.id,
        divisionName: b.division.name,
        poolGamesTotal,
        poolGamesIncomplete,
        needsResolutionRefresh: b.needsResolutionRefresh,
        usesPoolSeeding,
      } satisfies BracketProgressForPublicSettings;
    }),
  );

  return enriched;
}
