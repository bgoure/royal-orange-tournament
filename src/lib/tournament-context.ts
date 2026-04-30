import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const TOURNAMENT_SLUG_COOKIE = "tournament_slug";

/** Hide switcher entries for events whose first day is more than this many calendar months after today. */
const SWITCHER_MAX_LEAD_MONTHS = 2;

/** Live tournaments only: published, not archived, within switcher date window. */
function switcherListWhere() {
  const now = new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + SWITCHER_MAX_LEAD_MONTHS, now.getUTCDate()),
  );
  return {
    isPublished: true as const,
    archivedAt: null,
    startDate: { lte: cutoff },
  };
}

const switcherListOrderBy = [
  { publicSwitcherOrder: "asc" as const },
  { startDate: "asc" as const },
  { slug: "asc" as const },
];

/** Single-segment public URLs: active tournaments only. */
function publishedActiveSlugWhere(slug: string) {
  return {
    slug: { equals: slug, mode: "insensitive" as const },
    isPublished: true as const,
    archivedAt: null,
  };
}

export async function getSelectedTournamentSlug(): Promise<string | null> {
  const c = await cookies();
  return c.get(TOURNAMENT_SLUG_COOKIE)?.value ?? null;
}

/** Active (non-archived) published tournament for `/{slug}` routes. */
export async function getPublishedTournamentBySlug(slug: string) {
  return prisma.tournament.findFirst({
    where: publishedActiveSlugWhere(slug),
  });
}

/** Published tournament by slug (live or archived). For server actions that only receive the slug. */
export async function getPublishedTournamentBySlugForActions(slug: string) {
  return prisma.tournament.findFirst({
    where: {
      slug: { equals: slug, mode: "insensitive" },
      isPublished: true,
    },
  });
}

/** Archived tournament for `/past/{archiveFolder}/{slug}` historical viewing. */
export async function getArchivedPublishedTournamentByFolderAndSlug(archiveFolder: string, slug: string) {
  return prisma.tournament.findFirst({
    where: {
      archiveFolder: { equals: archiveFolder, mode: "insensitive" },
      slug: { equals: slug, mode: "insensitive" },
      isPublished: true,
      archivedAt: { not: null },
    },
  });
}

/** Archived published row by slug only (for legacy `/{slug}` → canonical archive URL). */
export async function getArchivedPublishedTournamentBySlug(slug: string) {
  return prisma.tournament.findFirst({
    where: {
      slug: { equals: slug, mode: "insensitive" },
      isPublished: true,
      archivedAt: { not: null },
      archiveFolder: { not: null },
    },
  });
}

/** First live tournament slug for redirecting `/` on the public site. */
export async function getDefaultPublicTournamentSlug(): Promise<string | null> {
  const withinSwitcherWindow = await prisma.tournament.findFirst({
    where: switcherListWhere(),
    orderBy: switcherListOrderBy,
    select: { slug: true },
  });
  if (withinSwitcherWindow) return withinSwitcherWindow.slug;
  const any = await prisma.tournament.findFirst({
    where: { isPublished: true, archivedAt: null },
    orderBy: switcherListOrderBy,
    select: { slug: true },
  });
  return any?.slug ?? null;
}

/**
 * Tournament for admin + cookie context: any published row (live or archived) matching the slug cookie,
 * else first live tournament in the switcher window, else any live published tournament.
 */
export async function getTournamentForRequest() {
  const slug = await getSelectedTournamentSlug();
  if (slug) {
    const t = await prisma.tournament.findFirst({
      where: {
        slug: { equals: slug, mode: "insensitive" },
        isPublished: true,
      },
    });
    if (t) return t;
  }
  const withinSwitcherWindow = await prisma.tournament.findFirst({
    where: switcherListWhere(),
    orderBy: switcherListOrderBy,
  });
  if (withinSwitcherWindow) return withinSwitcherWindow;
  return prisma.tournament.findFirst({
    where: { isPublished: true, archivedAt: null },
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
