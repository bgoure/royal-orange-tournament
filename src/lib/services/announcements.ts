import { prisma } from "@/lib/db";

export function listAnnouncements(tournamentId: string) {
  return prisma.announcement.findMany({
    where: { tournamentId },
    orderBy: [{ priority: "desc" }, { publishedAt: "desc" }],
  });
}

export function listAnnouncementsForAdmin(tournamentId: string) {
  return prisma.announcement.findMany({
    where: { tournamentId },
    orderBy: [{ priority: "desc" }, { publishedAt: "desc" }],
  });
}
