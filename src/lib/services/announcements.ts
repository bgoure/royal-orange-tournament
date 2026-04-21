import { prisma } from "@/lib/db";

/** Single “hero” announcement for home: priority first, then newest by published time. */
export function listLatestAnnouncementForHome(tournamentId: string) {
  return prisma.announcement.findFirst({
    where: { tournamentId },
    orderBy: [{ priority: "desc" }, { publishedAt: "desc" }],
  });
}

export function countAnnouncements(tournamentId: string) {
  return prisma.announcement.count({ where: { tournamentId } });
}

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
