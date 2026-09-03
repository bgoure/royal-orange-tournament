import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/rbac/permissions";
import { assertUserCanAccessTournament } from "@/lib/rbac/tenant-access";
import { ADMIN_TOURNAMENT_SLUG_COOKIE, TOURNAMENT_SLUG_COOKIE } from "@/lib/tournament-context";

const cookieOpts = {
  path: "/",
  maxAge: 60 * 60 * 24 * 400,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function safeAdminNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/admin/tournament-settings";
  if (!raw.startsWith("/admin")) return "/admin/tournament-settings";
  try {
    const u = new URL(raw, "http://local.invalid");
    if (!u.pathname.startsWith("/admin")) return "/admin/tournament-settings";
    // Keep the fragment so nav shortcuts land on their section after the cookie swap.
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return "/admin/tournament-settings";
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || !role || !isStaffRole(role)) {
    return NextResponse.redirect(new URL("/login?callbackUrl=/admin", request.url));
  }

  // Scorekeepers stay on games; selection still must authorize for cookie hygiene.
  const { slug: rawSlug } = await context.params;
  const tournament = await prisma.tournament.findFirst({
    where: { slug: { equals: rawSlug, mode: "insensitive" } },
    select: { id: true, slug: true },
  });

  if (!tournament) {
    return NextResponse.redirect(new URL("/admin?error=not-found", request.url));
  }

  const access = await assertUserCanAccessTournament(
    { userId: session.user.id, role },
    { id: tournament.id },
  );
  if (!access.ok) {
    return NextResponse.redirect(new URL("/admin?error=forbidden", request.url));
  }

  const url = new URL(request.url);
  const next =
    role === "SCOREKEEPER"
      ? "/admin/games?mode=scorekeeper"
      : safeAdminNextPath(url.searchParams.get("next"));

  const res = NextResponse.redirect(new URL(next, request.url));
  res.cookies.set(ADMIN_TOURNAMENT_SLUG_COOKIE, tournament.slug, cookieOpts);
  res.cookies.set(TOURNAMENT_SLUG_COOKIE, tournament.slug, cookieOpts);
  return res;
}
