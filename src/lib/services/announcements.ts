import { prisma } from "@/lib/db";

export function listAnnouncements(tournamentId: string) {
  return prisma.announcement.findMany({
    where: { tournamentId },
    orderBy: [{ priority: "desc" }, { publishedAt: "desc" }],
  });
}
