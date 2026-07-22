import { jsonError, jsonOk, resolveApiUser } from "@/lib/api/v1/auth";

/**
 * Lets an Expo client verify its stored credential (bearer token or, in a webview, the session
 * cookie) still maps to a signed-in user, and read the current role. See `docs/api-v1.md`.
 */
export async function POST(req: Request) {
  const user = await resolveApiUser(req);
  if (!user) return jsonError("Unauthorized", 401);
  return jsonOk({ user: { id: user.id, email: user.email, role: user.role } });
}

/** Convenience alias for `POST` (some HTTP clients default session checks to GET). */
export async function GET(req: Request) {
  return POST(req);
}
