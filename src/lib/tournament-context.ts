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

/**
 * If `fromSlug` was a former public URL, return the published tournament it should redirect to.
 */
export async function getTournamentForSlugRedirect(fromSlug: string) {
  const row = await prisma.tournamentSlugRedirect.findFirst({
    where: { fromSlug: { equals: fromSlug, mode: "insensitive" } },
    select: {
      tournament: true,
    },
  });
  const t = row?.tournament;
  if (!t || !t.isPublished) return null;
  return t;
}

/** First live tournament slug for redirecting `/` on the public site.
 * Prefer the visitor’s `tournament_slug` cookie when it still matches a published live event,
 * so admin “Public site” and post-create flows land on the event they were working on.
 */
export async function getDefaultPublicTournamentSlug(): Promise<string | null> {
  const cookieSlug = await getSelectedTournamentSlug();
  if (cookieSlug) {
    const fromCookie = await prisma.tournament.findFirst({
      where: {
        slug: { equals: cookieSlug, mode: "insensitive" },
        isPublished: true,
        archivedAt: null,
      },
      select: { slug: true },
    });
    if (fromCookie) return fromCookie.slug;
  }

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
 * Tournament for admin + cookie context:
 * - `admin_tournament_slug` first (includes drafts / unpublished)
 * - then public `tournament_slug` (published only)
 * - else first live published tournament in the switcher window
 */
export async function getTournamentForRequest(): Promise<TournamentForRequest | null> {
  const trySlug = async (slug: string | null, opts?: { publishedOnly?: boolean }) => {
    if (!slug) return null;
    return prisma.tournament.findFirst({
      where: {
        slug: { equals: slug, mode: "insensitive" },
        ...(opts?.publishedOnly ? { isPublished: true } : {}),
      },
      include: tournamentForRequestInclude,
    });
  };

  const fromAdmin = await trySlug(await getAdminSelectedTournamentSlug());
  if (fromAdmin) return fromAdmin;

  const fromPublic = await trySlug(await getSelectedTournamentSlug(), { publishedOnly: true });
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

/** All tournaments for the admin hub (published + drafts).
 * Non-ADMIN staff only see tournaments owned by their organization(s).
 */
export async function listTournamentsForAdminHub(opts?: {
  userId?: string;
  role?: string;
}) {
  const where: {
    organizationId?: { in: string[] } | null;
  } = {};

  if (opts?.userId && opts.role && opts.role !== "ADMIN") {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: opts.userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);
    if (orgIds.length === 0) {
      return [];
    }
    where.organizationId = { in: orgIds };
  }

  return prisma.tournament.findMany({
    where,
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
      organizationId: true,
      isPublished: true,
    },
  });
}

/** Live published events in the public switcher date window (header switcher). */
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

/** All live published tournaments for the marketing directory (no lead-time window). */
export async function listLiveTournamentsForDirectory() {
  return prisma.tournament.findMany({
    where: { isPublished: true, archivedAt: null },
    orderBy: [{ startDate: "asc" }, { publicSwitcherOrder: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      shortLabel: true,
      locationLabel: true,
      startDate: true,
      endDate: true,
      archiveFolder: true,
      archivedAt: true,
    },
  });
}

/** Request clock for pure RSC rendering of marketing directory. */
export async function getRequestNowMs(): Promise<number> {
  return Date.now();
}
