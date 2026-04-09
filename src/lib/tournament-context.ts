import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const TOURNAMENT_SLUG_COOKIE = "tournament_slug";

/** Hide switcher entries for events whose first day is more than this many calendar months after today. */
const SWITCHER_MAX_LEAD_MONTHS = 2;

/** Published tournaments shown in the public switcher: not too far in the future, newest start date first. */
function switcherListWhere() {
  const now = new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + SWITCHER_MAX_LEAD_MONTHS, now.getUTCDate()),
  );
  return { isPublished: true as const, startDate: { lte: cutoff } };
}

const switcherListOrderBy = [{ startDate: "desc" as const }, { slug: "asc" as const }];

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
  const withinSwitcherWindow = await prisma.tournament.findFirst({
    where: switcherListWhere(),
    orderBy: switcherListOrderBy,
  });
  if (withinSwitcherWindow) return withinSwitcherWindow;
  return prisma.tournament.findFirst({
    where: { isPublished: true },
    orderBy: switcherListOrderBy,
  });
}

export async function listPublishedTournaments() {
  return prisma.tournament.findMany({
    where: switcherListWhere(),
    orderBy: switcherListOrderBy,
    select: {
      id: true,
      name: true,
      slug: true,
      locationLabel: true,
      startDate: true,
      endDate: true,
    },
  });
}
