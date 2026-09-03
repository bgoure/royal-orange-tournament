import type { Role, Tournament } from "@prisma/client";
import { OrganizationMemberRole } from "@prisma/client";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getTournamentForRequest, type TournamentForRequest } from "@/lib/tournament-context";

/**
 * Platform ADMIN cross-organization bypass — keep this as the single explicit escape hatch.
 * Organization membership still applies to all other staff roles.
 *
 * Note: intentionally no `server-only` import so node:test can exercise assertUserCanAccessTournament
 * without the React Server Components package boundary. Call sites remain admin/server actions.
 */
export function isPlatformAdmin(role: Role | string | undefined | null): boolean {
  return role === "ADMIN";
}

export type TournamentAccessDenied = {
  ok: false;
  status: 401 | 403 | 404;
  error: string;
};

export type TournamentAccessGranted = {
  ok: true;
  tournament: Pick<Tournament, "id" | "slug" | "organizationId" | "name" | "isPublished">;
  /** True when access was granted via platform ADMIN bypass (not org membership). */
  viaPlatformAdminBypass: boolean;
  organizationMemberRole: OrganizationMemberRole | null;
};

export type TournamentAccessResult = TournamentAccessGranted | TournamentAccessDenied;

type Actor = { userId: string; role: Role };

/**
 * Authorize that a user may access a tournament for admin/staff mutations.
 * Cookie selection is never proof of access — always call this with the real tournament id/slug.
 *
 * Rules:
 * - Unauthenticated → 401
 * - Platform ADMIN → allowed for any tournament (explicit bypass)
 * - Staff with active OrganizationMember for the tournament's organization → allowed
 * - Legacy tournaments with null organizationId → only platform ADMIN
 * - Others → 403
 */
export async function assertUserCanAccessTournament(
  actor: Actor | null | undefined,
  tournamentRef: { id: string } | { slug: string },
): Promise<TournamentAccessResult> {
  if (!actor?.userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const tournament = await prisma.tournament.findFirst({
    where:
      "id" in tournamentRef
        ? { id: tournamentRef.id }
        : { slug: { equals: tournamentRef.slug, mode: "insensitive" } },
    select: {
      id: true,
      slug: true,
      organizationId: true,
      name: true,
      isPublished: true,
    },
  });

  if (!tournament) {
    return { ok: false, status: 404, error: "Tournament not found." };
  }

  if (isPlatformAdmin(actor.role)) {
    return {
      ok: true,
      tournament,
      viaPlatformAdminBypass: true,
      organizationMemberRole: null,
    };
  }

  if (!tournament.organizationId) {
    return {
      ok: false,
      status: 403,
      error: "This tournament is not linked to an organization you can access.",
    };
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: tournament.organizationId,
        userId: actor.userId,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    return {
      ok: false,
      status: 403,
      error: "You do not have access to this tournament’s organization.",
    };
  }

  return {
    ok: true,
    tournament,
    viaPlatformAdminBypass: false,
    organizationMemberRole: membership.role,
  };
}

/** Error string helper for server actions that prefer `{ error: string }`. */
export async function denyUnlessTournamentAccess(
  actor: Actor | null | undefined,
  tournamentRef: { id: string } | { slug: string },
): Promise<string | null> {
  const result = await assertUserCanAccessTournament(actor, tournamentRef);
  return result.ok ? null : result.error;
}

/**
 * Cookie-selected tournament for admin UI, or null when the actor may not access it.
 * Use this for page renders — never treat the cookie alone as proof of access.
 */
export async function getAuthorizedTournamentForAdmin(
  actor: Actor | null | undefined,
): Promise<TournamentForRequest | null> {
  if (!actor?.userId) return null;
  const tournament = await getTournamentForRequest();
  if (!tournament) return null;
  const access = await assertUserCanAccessTournament(actor, { id: tournament.id });
  if (!access.ok) return null;
  return tournament;
}

/** Session + authorized tournament for admin page Server Components. */
export async function loadAdminPageTournament(): Promise<{
  session: Session | null;
  tournament: TournamentForRequest | null;
}> {
  const session = await auth();
  if (!session?.user?.id) return { session: null, tournament: null };
  const tournament = await getAuthorizedTournamentForAdmin({
    userId: session.user.id,
    role: session.user.role,
  });
  return { session, tournament };
}

/**
 * Cookie-selected tournament + org authorization for admin server actions.
 */
export async function requireAuthorizedTournamentContext(): Promise<
  { session: Session; tournament: TournamentForRequest } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const tournament = await getAuthorizedTournamentForAdmin({
    userId: session.user.id,
    role: session.user.role,
  });
  if (!tournament) {
    return {
      error: "Open All tournaments in the admin sidebar, pick an event, or use the public site switcher.",
    };
  }
  return { session, tournament };
}

/**
 * Ensure a user is an OrganizationMember of the given org (idempotent).
 * Used when inviting staff so User.role and org membership stay consistent.
 */
export async function ensureOrganizationMembership(opts: {
  organizationId: string;
  userId: string;
  role?: OrganizationMemberRole;
}): Promise<void> {
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: opts.organizationId,
        userId: opts.userId,
      },
    },
    create: {
      organizationId: opts.organizationId,
      userId: opts.userId,
      role: opts.role ?? OrganizationMemberRole.MEMBER,
    },
    update: {},
  });
}

/**
 * Resolve an organization to attach invited staff to — prefer the tournament
 * currently being administered, else the inviter's first membership.
 */
export async function resolveInviteOrganizationId(opts: {
  inviterUserId: string;
  tournamentOrganizationId: string | null | undefined;
}): Promise<string | null> {
  if (opts.tournamentOrganizationId) return opts.tournamentOrganizationId;
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: opts.inviterUserId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  return membership?.organizationId ?? null;
}
