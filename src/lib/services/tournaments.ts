import { prisma } from "@/lib/db";

export function getTournamentBySlug(slug: string) {
  return prisma.tournament.findFirst({
    where: { slug, isPublished: true },
  });
}
