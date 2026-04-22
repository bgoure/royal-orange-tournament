import { GameKind } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertDivisionRoundRobinCompleteForSeeding } from "@/lib/services/round-robin-division";

/** Clear home/away on playoff games after round 0 (winner advancement slots). */
export async function clearLaterBracketRoundTeamSlots(tournamentId: string): Promise<void> {
  const games = await prisma.game.findMany({
    where: {
      tournamentId,
      bracketRound: { roundIndex: { gt: 0 } },
    },
    select: { id: true },
  });
  if (games.length === 0) return;
  await prisma.game.updateMany({
    where: { id: { in: games.map((g) => g.id) } },
    data: { homeTeamId: null, awayTeamId: null },
  });
}

/** Clear consolation matchup teams (re-filled from standings during hydration). */
export async function clearConsolationGameTeamSlots(tournamentId: string): Promise<void> {
  await prisma.game.updateMany({
    where: { tournamentId, gameKind: GameKind.CONSOLATION },
    data: { homeTeamId: null, awayTeamId: null },
  });
}

/** After pool standings change, flag the division playoff bracket so admins re-apply seeds intentionally. */
export async function markBracketsStaleForDivision(divisionId: string): Promise<void> {
  await prisma.bracket.updateMany({
    where: { divisionId },
    data: { needsResolutionRefresh: true },
  });
}

async function hydrateBracketRoundZeroAndConsolationTx(
  tx: Prisma.TransactionClient,
  bracketId: string,
  tournamentId: string,
  divisionId: string,
): Promise<void> {
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

  const consolationGames = await tx.game.findMany({
    where: {
      tournamentId,
      divisionId,
      gameKind: GameKind.CONSOLATION,
    },
  });
  for (const g of consolationGames) {
    if (
      !g.consolationHomePoolId ||
      g.consolationHomeRank == null ||
      !g.consolationAwayPoolId ||
      g.consolationAwayRank == null
    ) {
      continue;
    }
    const homeId = await teamAtPoolRank(g.consolationHomePoolId, g.consolationHomeRank);
    const awayId = await teamAtPoolRank(g.consolationAwayPoolId, g.consolationAwayRank);
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
    await hydrateBracketRoundZeroAndConsolationTx(tx, bracketId, meta.tournamentId, meta.divisionId);
  });
}

/**
 * Same hydration as `resolveBracketTeamsFromStandings` but skips the “all pool games final/cancelled” check.
 * Used only from admin soft reset so bracket round 0 + consolation repopulate from current standings (e.g. 0–0).
 */
export async function resolveBracketTeamsFromStandingsAllowIncomplete(bracketId: string): Promise<void> {
  const meta = await prisma.bracket.findFirst({
    where: { id: bracketId },
    select: { tournamentId: true, divisionId: true },
  });
  if (!meta) throw new Error("Bracket not found");

  await prisma.$transaction(async (tx) => {
    await hydrateBracketRoundZeroAndConsolationTx(tx, bracketId, meta.tournamentId, meta.divisionId);
  });
}
