import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { TOURNEY_PATHNAME_HEADER } from "@/lib/tourney-request";

/**
 * Admin/staff gate without `NextAuth().auth()` — that runs the full Auth session action on Edge
 * and has been unreliable on Vercel (MIDDLEWARE_INVOCATION_FAILED).
 * We use JWT sessions only (`auth.ts`), so `getToken` is sufficient here.
 */
const STAFF_ROLES = new Set<string>(["POWER_USER", "ADMIN"]);

function withPathnameHeader(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(TOURNEY_PATHNAME_HEADER, req.nextUrl.pathname);
  return requestHeaders;
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const requestHeaders = withPathnameHeader(req);

  const isProtected = path.startsWith("/admin") || path.startsWith("/api/admin");
  if (!isProtected) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

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

  const isApi = path.startsWith("/api/admin");

  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(login);
  }

  const role = typeof token.role === "string" ? token.role : undefined;
  if (!STAFF_ROLES.has(role ?? "")) {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const home = new URL("/", req.nextUrl.origin).toString();
    const signOut = new URL("/api/auth/signout", req.nextUrl.origin).toString();
    const roleLabel =
      role === "ADMIN" || role === "POWER_USER" || role === "PUBLIC" ? role : "PUBLIC";
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>No admin access</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5;color:#18181b">
<h1 style="font-size:1.25rem">You’re signed in, but not as staff</h1>
<p>Your account has role <strong>${roleLabel}</strong>. Only <strong>ADMIN</strong> or <strong>POWER_USER</strong> can open the admin portal.</p>
<p>Ask someone who already has admin access to upgrade your user in the database, or add your Google email to a seeded admin user.</p>
<p><a href="${home}">Back to site</a> · <a href="${signOut}">Sign out</a></p>
</body></html>`;
    return new NextResponse(html, {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
