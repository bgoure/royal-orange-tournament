import { prisma } from "@/lib/db";
import { assertDivisionRoundRobinCompleteForSeeding } from "@/lib/services/round-robin-division";

/** After pool standings change, flag the division playoff bracket so admins re-apply seeds intentionally. */
export async function markBracketsStaleForDivision(divisionId: string): Promise<void> {
  await prisma.bracket.updateMany({
    where: { divisionId },
    data: { needsResolutionRefresh: true },
  });
}

/** Fill round-0 teams from current pool standings (sources on BracketMatch). Clears needsResolutionRefresh. */
export async function resolveBracketTeamsFromStandings(bracketId: string): Promise<void> {
  const meta = await prisma.bracket.findFirst({
    where: { id: bracketId },
    select: { tournamentId: true, divisionId: true },
  });
  if (!meta) throw new Error("Bracket not found");
  await assertDivisionRoundRobinCompleteForSeeding(meta.tournamentId, meta.divisionId);

  await prisma.$transaction(async (tx) => {
    async function teamAtPoolRank(poolId: string, rank: number): Promise<string | null> {
      const rows = await tx.poolStanding.findMany({
        where: { poolId },
        orderBy: { displayOrder: "asc" },
        select: { teamId: true },
      });
      const i = rank - 1;
      if (i < 0 || i >= rows.length) return null;
      return rows[i]!.teamId;
    }

    const bracket = await tx.bracket.findFirst({
      where: { id: bracketId },
      include: { rounds: { orderBy: { roundIndex: "asc" } } },
    });
    if (!bracket) throw new Error("Bracket not found");

    const round0 = bracket.rounds[0];
    if (!round0) return;

    const bms = await tx.bracketMatch.findMany({
      where: { bracketRoundId: round0.id },
      include: { game: true },
    });

    for (const m of bms) {
      const g = m.game;
      if (!g) continue;
      if (!m.homeSourcePoolId || !m.homeSourceRank || !m.awaySourcePoolId || !m.awaySourceRank) continue;
      const homeId = await teamAtPoolRank(m.homeSourcePoolId, m.homeSourceRank);
      const awayId = await teamAtPoolRank(m.awaySourcePoolId, m.awaySourceRank);
      await tx.game.update({
        where: { id: g.id },
        data: {
          homeTeamId: homeId,
          awayTeamId: awayId,
        },
      });
    }

    await tx.bracket.update({
      where: { id: bracketId },
      data: { needsResolutionRefresh: false },
    });
  });
}
