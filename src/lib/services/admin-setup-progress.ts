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

  // Heal stale wizard locationLabel ("TBD") when headquarters already has a real venue.
  let locationLabel = tournament?.locationLabel ?? null;
  if (
    hq &&
    !isWizardTbdVenue(hq.name) &&
    isWizardTbdVenue(locationLabel)
  ) {
    const addr = hq.address?.trim() ?? "";
    const healed = (!isWizardTbdVenue(addr) ? addr : hq.name).trim().slice(0, 200);
    if (!isWizardTbdVenue(healed)) {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { locationLabel: healed },
      });
      locationLabel = healed;
    }
  }

  const teamsNamed =
    teams.length === 0 || teams.every((t) => !PLACEHOLDER_TEAM_NAME_RE.test(t.name));

  // Venue is complete when headquarters has a real name and either a real address
  // or a non-placeholder locationLabel.
  const hqNameOk = !isWizardTbdVenue(hq?.name);
  const addressOk = !isWizardTbdVenue(hq?.address) || !isWizardTbdVenue(locationLabel);
  const hasVenue = hq != null && hqNameOk && addressOk;

  return {
    teamsNamed,
    hasVenue,
    hasField: fieldCount >= 1,
    hasPoolGames: poolGameCount >= 1,
    hasBracket: bracketCount >= 1,
    isPublished: tournament?.isPublished === true,
  };
}
