import { GameKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  PLACEHOLDER_TEAM_NAME_RE,
  type SetupProgress,
} from "@/lib/admin-setup-checklist";

export async function getTournamentSetupProgress(tournamentId: string): Promise<SetupProgress> {
  const [teams, fieldCount, poolGameCount, bracketCount] = await Promise.all([
    prisma.team.findMany({
      where: { pool: { division: { tournamentId } } },
      select: { name: true },
    }),
    prisma.field.count({ where: { tournamentId } }),
    prisma.game.count({
      where: { tournamentId, gameKind: GameKind.POOL },
    }),
    prisma.bracket.count({
      where: { division: { tournamentId } },
    }),
  ]);

  const teamsNamed =
    teams.length === 0 || teams.every((t) => !PLACEHOLDER_TEAM_NAME_RE.test(t.name));

  return {
    teamsNamed,
    hasField: fieldCount >= 1,
    hasPoolGames: poolGameCount >= 1,
    hasBracket: bracketCount >= 1,
  };
}
