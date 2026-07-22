import { issueApiBearerToken, jsonError, jsonOk, resolveApiUser } from "@/lib/api/v1/auth";

/**
 * Mints a long-lived, opaque, DB-backed Bearer token (`ApiBearerToken`) for the caller's
 * already-authenticated session (cookie, or an existing bearer credential). Expo can store this
 * token securely and use it instead of re-sending the raw Auth.js session JWT on every request.
 *
 * We didn't add the spec's alternate `{ email, password }` flow: the app's Credentials provider
 * is a disabled no-op unless Google OAuth env vars are unset (see `src/auth.config.ts`), so
 * there's no real password check to perform. Sign in via Google in a browser/webview once, then
 * call this endpoint (with the session cookie, or the raw session JWT as a bearer token) to get a
 * stable credential for the rest of the app's lifetime.
 */
export async function POST(req: Request) {
  const user = await resolveApiUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 100) : "Expo";

  const issued = await issueApiBearerToken(user.id, name);
  return jsonOk({
    token: issued.token,
    expiresAt: issued.expiresAt.toISOString(),
    user: { id: user.id, email: user.email, role: user.role },
  });
}
