import { GameKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  PLACEHOLDER_TEAM_NAME_RE,
  isWizardTbdVenue,
  type SetupProgress,
} from "@/lib/admin-setup-checklist";

export async function getTournamentSetupProgress(tournamentId: string): Promise<SetupProgress> {
  const [teams, fieldCount, poolGameCount, bracketCount, tournament, hq] = await Promise.all([
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
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { isPublished: true, locationLabel: true },
    }),
    prisma.location.findFirst({
      where: { tournamentId, isHeadquarters: true },
      select: { name: true, address: true },
    }),
  ]);

  const teamsNamed =
    teams.length === 0 || teams.every((t) => !PLACEHOLDER_TEAM_NAME_RE.test(t.name));

  const hasVenue =
    !isWizardTbdVenue(hq?.name) &&
    !isWizardTbdVenue(hq?.address) &&
    !isWizardTbdVenue(tournament?.locationLabel);

  return {
    teamsNamed,
    hasVenue,
    hasField: fieldCount >= 1,
    hasPoolGames: poolGameCount >= 1,
    hasBracket: bracketCount >= 1,
    isPublished: tournament?.isPublished === true,
  };
}
