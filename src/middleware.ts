import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Admin/staff gate without `NextAuth().auth()` — that runs the full Auth session action on Edge
 * and has been unreliable on Vercel (MIDDLEWARE_INVOCATION_FAILED).
 * We use JWT sessions only (`auth.ts`), so `getToken` is sufficient here.
 */
const STAFF_ROLES = new Set<string>(["POWER_USER", "ADMIN"]);

export async function middleware(req: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (typeof secret !== "string" || secret.length === 0) {
    return new NextResponse(
      "Server misconfiguration: set AUTH_SECRET or NEXTAUTH_SECRET for the project.",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const secureCookie = req.nextUrl.protocol === "https:";
  const token = await getToken({
    req,
    secret,
    secureCookie,
  });

  const path = req.nextUrl.pathname;
  const isApi = path.startsWith("/api/admin");

  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signIn = new URL("/api/auth/signin", req.nextUrl.origin);
    signIn.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(signIn);
  }

  const role = typeof token.role === "string" ? token.role : undefined;
  if (!STAFF_ROLES.has(role ?? "")) {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return new NextResponse(null, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
