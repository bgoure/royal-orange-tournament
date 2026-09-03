import { prisma } from "@/lib/db";

export type TeamGameReference = {
  gameId: string;
  /** Playoff/bracket game vs. pool-play (or consolation) game — drives the wording of the error. */
  kind: "bracket" | "pool";
};

/**
 * First game that still lists this team as home or away, if any.
 * Bracket games win the tie so the message points at the harder problem to unwind.
 */
export async function findGameReferencingTeam(
  teamId: string,
  tournamentId: string,
): Promise<TeamGameReference | null> {
  const inTeamSeat = {
    tournamentId,
    OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
  };

  const bracketGame = await prisma.game.findFirst({
    where: { ...inTeamSeat, bracketId: { not: null } },
    select: { id: true },
  });
  if (bracketGame) return { gameId: bracketGame.id, kind: "bracket" };

  const anyGame = await prisma.game.findFirst({
    where: inTeamSeat,
    select: { id: true },
  });
  return anyGame ? { gameId: anyGame.id, kind: "pool" } : null;
}

export function teamDeletionBlockedMessage(kind: TeamGameReference["kind"]): string {
  return kind === "bracket"
    ? "This team is listed in a playoff game. Remove or reassign it before deleting the team."
    : "This team is scheduled in at least one game. Delete or reassign those games before deleting the team.";
}

/**
 * Guard for `deleteTeam`. Returns an error message when the team is still referenced by a game,
 * or `null` when it is safe to delete.
 *
 * The database no longer cascades team deletes into games (`Game.homeTeamId`/`awayTeamId` are
 * `ON DELETE SET NULL`), so without this check a delete would silently strip the team out of
 * played games instead of removing them.
 */
export async function teamDeletionBlockReason(
  teamId: string,
  tournamentId: string,
): Promise<string | null> {
  const reference = await findGameReferencingTeam(teamId, tournamentId);
  return reference ? teamDeletionBlockedMessage(reference.kind) : null;
}
