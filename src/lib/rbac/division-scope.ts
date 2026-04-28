import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canAccessDivision } from "@/lib/rbac/permissions";

/**
 * For a POWER_USER, loads their assigned division IDs and checks if the target division is in scope.
 * ADMINs always pass. Returns an error string if denied, null if allowed.
 */
export async function assertDivisionScope(
  userId: string,
  role: Role,
  targetDivisionId: string,
): Promise<string | null> {
  if (role === "ADMIN") return null;
  if (role !== "POWER_USER") return "You don't have permission for this action.";

  const assignments = await prisma.userDivisionAssignment.findMany({
    where: { userId },
    select: { divisionId: true },
  });
  const assignedIds = new Set(assignments.map((a) => a.divisionId));

  if (!canAccessDivision(role, assignedIds, targetDivisionId)) {
    return "You don't have access to this division.";
  }
  return null;
}

/**
 * Resolves the division ID from a pool ID and checks scope.
 */
export async function assertPoolDivisionScope(
  userId: string,
  role: Role,
  poolId: string,
): Promise<string | null> {
  if (role === "ADMIN") return null;

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { divisionId: true },
  });
  if (!pool) return "Pool not found.";

  return assertDivisionScope(userId, role, pool.divisionId);
}

/**
 * Resolves the division ID from a team ID (team → pool → division) and checks scope.
 */
export async function assertTeamDivisionScope(
  userId: string,
  role: Role,
  teamId: string,
): Promise<string | null> {
  if (role === "ADMIN") return null;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { pool: { select: { divisionId: true } } },
  });
  if (!team) return "Team not found.";

  return assertDivisionScope(userId, role, team.pool.divisionId);
}

/**
 * Resolves the division from a game's pool or direct division link and checks scope.
 */
export async function assertGameDivisionScope(
  userId: string,
  role: Role,
  gameId: string,
): Promise<string | null> {
  if (role === "ADMIN") return null;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { divisionId: true, pool: { select: { divisionId: true } } },
  });
  if (!game) return "Game not found.";

  const divId = game.pool?.divisionId ?? game.divisionId;
  if (!divId) return "Game is not associated with a division.";

  return assertDivisionScope(userId, role, divId);
}
