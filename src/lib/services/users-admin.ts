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
    },
  });
}

export function countAdmins() {
  return prisma.user.count({ where: { role: "ADMIN" } });
}
