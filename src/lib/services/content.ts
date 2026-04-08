import { prisma } from "@/lib/db";

export function listFaqItems(tournamentId: string) {
  return prisma.faqItem.findMany({
    where: { tournamentId, published: true },
    orderBy: { sortOrder: "asc" },
  });
}

export function listFaqItemsForAdmin(tournamentId: string) {
  return prisma.faqItem.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
  });
}

export function listLocations(tournamentId: string) {
  return prisma.location.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
  });
}

/** Locations with nested fields (diamonds), ordered for admin hierarchy UI. */
export function listLocationsWithFields(tournamentId: string) {
  return prisma.location.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export function getHeadquartersLocation(tournamentId: string) {
  return prisma.location.findFirst({
    where: { tournamentId, isHeadquarters: true },
  });
}
