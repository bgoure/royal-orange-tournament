import { prisma } from "@/lib/db";

export function listFaqItems(tournamentId: string) {
  return prisma.faqItem.findMany({
    where: { tournamentId, published: true },
    orderBy: { sortOrder: "asc" },
  });
}

export function listVenues(tournamentId: string) {
  return prisma.venue.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
  });
}
