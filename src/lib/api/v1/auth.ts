import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** 200 JSON response with the given payload (pass `status` for 201/etc.). */
export function jsonOk<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/** `{ error: message }` JSON response. Defaults to 400; pass 401/403/404/etc. as needed. */
export function jsonError(message: string, status = 400): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status });
}

/** Caller identity for `/api/v1` routes. See `docs/api-v1.md` for the supported credential types. */
export type ApiUser = { id: string; email: string | null; role: Role };

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Issues a long-lived, opaque, DB-backed Bearer token (via `POST /api/v1/auth/token`). Returns the raw token once — only the hash is stored. */
export async function issueApiBearerToken(
  userId: string,
  name = "Expo",
  expiresInDays = 90,
): Promise<{ token: string; expiresAt: Date }> {
  const raw = `th_${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  await prisma.apiBearerToken.create({
    data: { userId, name, tokenHash: hashToken(raw), expiresAt },
  });
  return { token: raw, expiresAt };
}

async function resolveOpaqueBearerUser(raw: string): Promise<ApiUser | null> {
  const row = await prisma.apiBearerToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, email: true, role: true } } },
  });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
  await prisma.apiBearerToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return row.user;
}

/**
 * Decodes an Auth.js-issued session JWT passed directly as `Authorization: Bearer <token>` —
 * the same encrypted value Auth.js stores in the `authjs.session-token` cookie (or
 * `__Secure-authjs.session-token` over https). Expo has no cookie jar by default, so a client can
 * copy that cookie's value after a browser/webview sign-in and resend it as a bearer token.
 *
 * `secureCookie` is re-derived from the request's own protocol, matching how `src/proxy.ts`
 * validates the same cookie for `/api/admin`/`/admin` — the cookie name (and therefore the
 * decryption salt) depends on whether it was set over https.
 *
 * Decoding here bypasses NextAuth's own `jwt` callback — the thing that refreshes `role` from the
 * database at most once a minute (see `ROLE_REFRESH_MS` in `src/auth.ts`). To avoid trusting a
 * stale/embedded role indefinitely, we re-check the user's current role (and that they still
 * exist) directly against the `User` table.
 */
async function resolveSessionJwtBearerUser(request: Request, raw: string): Promise<ApiUser | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const secureCookie = new URL(request.url).protocol === "https:";
  let decoded: Awaited<ReturnType<typeof getToken>>;
  try {
    decoded = await getToken({
      req: { headers: new Headers({ authorization: `Bearer ${raw}` }) },
      secret,
      secureCookie,
    });
  } catch {
    return null;
  }
  if (!decoded?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, email: true, role: true },
  });
  return user ?? null;
}

/**
 * Resolves the authenticated caller for an `/api/v1` request, or `null` if unauthenticated.
 * Checked in order:
 *  1. `Authorization: Bearer th_...` — opaque, DB-backed token minted by `POST /api/v1/auth/token`.
 *  2. `Authorization: Bearer <jwt>` — the raw Auth.js session JWT (same value as the session cookie).
 *  3. The NextAuth session cookie, via `auth()` from `@/auth` (what the existing web app sends).
 */
export async function resolveApiUser(request: Request): Promise<ApiUser | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const raw = authHeader.slice(7).trim();
    if (raw.length > 0) {
      if (raw.startsWith("th_")) return resolveOpaqueBearerUser(raw);
      return resolveSessionJwtBearerUser(request, raw);
    }
  }

  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    role: session.user.role,
  };
}
