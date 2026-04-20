import { prisma } from "@/lib/db";

/** Ordered sponsor rows for the public home marquee (metadata only). */
export async function listSponsorsForMarquee(tournamentId: string) {
  return prisma.tournamentSponsor.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, updatedAt: true },
  });
}
