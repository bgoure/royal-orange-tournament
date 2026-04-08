import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/auth.config";

/** Edge middleware must not import `@/auth` (Prisma adapter blows the 1 MB Edge bundle limit). */
const { auth } = NextAuth(authConfig);

const STAFF_ROLES = new Set<string>(["POWER_USER", "ADMIN"]);

function isStaffRole(role: string | undefined): boolean {
  return role != null && STAFF_ROLES.has(role);
}

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isApi = path.startsWith("/api/admin");

  if (!req.auth?.user) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signIn = new URL("/api/auth/signin", req.nextUrl.origin);
    signIn.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(signIn);
  }

  if (!isStaffRole(req.auth.user.role)) {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return new NextResponse(null, { status: 403 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
