import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const TOURNAMENT_SLUG_COOKIE = "tournament_slug";

export async function getSelectedTournamentSlug(): Promise<string | null> {
  const c = await cookies();
  return c.get(TOURNAMENT_SLUG_COOKIE)?.value ?? null;
}

export async function getTournamentForRequest() {
  const slug = await getSelectedTournamentSlug();
  if (slug) {
    const t = await prisma.tournament.findFirst({
      where: { slug, isPublished: true },
    });
    if (t) return t;
  }
  return prisma.tournament.findFirst({
    where: { isPublished: true },
    orderBy: [{ startDate: "asc" }, { slug: "asc" }],
  });
}

export async function listPublishedTournaments() {
  return prisma.tournament.findMany({
    where: { isPublished: true },
    orderBy: [{ shortLabel: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      shortLabel: true,
      locationLabel: true,
      startDate: true,
      endDate: true,
    },
  });
}
