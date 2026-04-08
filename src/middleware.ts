import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Role } from "@prisma/client";

function isStaffRole(role: Role | undefined): boolean {
  return role === "POWER_USER" || role === "ADMIN";
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

  if (!isStaffRole(req.auth.user.role as Role)) {
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
