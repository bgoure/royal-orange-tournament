import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ADMIN_TOURNAMENT_SLUG_COOKIE } from "@/lib/tournament-context";

const cookieOpts = {
  path: "/",
  maxAge: 60 * 60 * 24 * 400,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function safeAdminNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/admin/tournament-settings";
  if (!raw.startsWith("/admin")) return "/admin/tournament-settings";
  return raw.split("?")[0] ?? "/admin/tournament-settings";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== "ADMIN" && role !== "POWER_USER")) {
    return NextResponse.redirect(new URL("/login?callbackUrl=/admin", request.url));
  }

  const { slug: rawSlug } = await context.params;
  const tournament = await prisma.tournament.findFirst({
    where: {
      slug: { equals: rawSlug, mode: "insensitive" },
      isPublished: true,
    },
    select: { slug: true },
  });

  if (!tournament) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const url = new URL(request.url);
  const next = safeAdminNextPath(url.searchParams.get("next"));

  const jar = await cookies();
  jar.set(ADMIN_TOURNAMENT_SLUG_COOKIE, tournament.slug, cookieOpts);

  return NextResponse.redirect(new URL(next, request.url));
}
