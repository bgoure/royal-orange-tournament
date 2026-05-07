import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const TOURNAMENT_SLUG_COOKIE = "tournament_slug";
/** Preferred context for /admin when set (via /admin/select/…). Overrides public-site `tournament_slug`. */
export const ADMIN_TOURNAMENT_SLUG_COOKIE = "admin_tournament_slug";

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

/** Loaded without logo bytes — only `updatedAt` for cache-busted `/api/game-sheet-logo/...` URLs. */
export const tournamentForRequestInclude = {
  gameSheetHeaderLogo: { select: { updatedAt: true } },
} satisfies Prisma.TournamentInclude;

export type TournamentForRequest = Prisma.TournamentGetPayload<{
  include: typeof tournamentForRequestInclude;
}>;

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

export async function getAdminSelectedTournamentSlug(): Promise<string | null> {
  const c = await cookies();
  return c.get(ADMIN_TOURNAMENT_SLUG_COOKIE)?.value ?? null;
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
 * Tournament for admin + cookie context: any published row (live or archived) matching
 * `admin_tournament_slug` first, then public `tournament_slug`, else first live tournament
 * in the switcher window, else any live published tournament.
 */
export async function getTournamentForRequest(): Promise<TournamentForRequest | null> {
  const trySlug = async (slug: string | null) => {
    if (!slug) return null;
    return prisma.tournament.findFirst({
      where: {
        slug: { equals: slug, mode: "insensitive" },
        isPublished: true,
      },
      include: tournamentForRequestInclude,
    });
  };

  const fromAdmin = await trySlug(await getAdminSelectedTournamentSlug());
  if (fromAdmin) return fromAdmin;

  const fromPublic = await trySlug(await getSelectedTournamentSlug());
  if (fromPublic) return fromPublic;

  const withinSwitcherWindow = await prisma.tournament.findFirst({
    where: switcherListWhere(),
    orderBy: switcherListOrderBy,
    include: tournamentForRequestInclude,
  });
  if (withinSwitcherWindow) return withinSwitcherWindow;
  return prisma.tournament.findFirst({
    where: { isPublished: true, archivedAt: null },
    orderBy: switcherListOrderBy,
    include: tournamentForRequestInclude,
  });
}

/** All published tournaments for the admin hub (live + archived). */
export async function listTournamentsForAdminHub() {
  return prisma.tournament.findMany({
    where: { isPublished: true },
    orderBy: [
      { publicSwitcherOrder: "asc" },
      { startDate: "asc" },
      { slug: "asc" },
    ],
    select: {
      id: true,
      name: true,
      slug: true,
      publicSwitcherOrder: true,
      archivedAt: true,
      archiveFolder: true,
      startDate: true,
      endDate: true,
      locationLabel: true,
    },
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
