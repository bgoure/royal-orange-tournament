import { prisma } from "@/lib/db";

export function listUsersForAdmin() {
  return prisma.user.findMany({
    orderBy: [{ email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      divisionAssignments: {
        select: {
          divisionId: true,
          division: { select: { id: true, name: true, tournament: { select: { name: true } } } },
        },
      },
    },
  });
}

export function countAdmins() {
  return prisma.user.count({ where: { role: "ADMIN" } });
}

/** Returns the set of division IDs a user is assigned to (for POWER_USER scope checks). */
export async function getUserAssignedDivisionIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.userDivisionAssignment.findMany({
    where: { userId },
    select: { divisionId: true },
  });
  return new Set(rows.map((r) => r.divisionId));
}

/** Assigns divisions to a user, replacing any existing assignments. */
export async function setUserDivisionAssignments(userId: string, divisionIds: string[]): Promise<void> {
  await prisma.$transaction([
    prisma.userDivisionAssignment.deleteMany({ where: { userId } }),
    ...divisionIds.map((divisionId) =>
      prisma.userDivisionAssignment.create({ data: { userId, divisionId } }),
    ),
  ]);
}
