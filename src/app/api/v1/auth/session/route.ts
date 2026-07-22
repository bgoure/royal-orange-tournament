import { jsonError, jsonOk, resolveApiUser, issueApiBearerToken } from "@/lib/api/v1/auth";
import { can } from "@/lib/rbac/permissions";

export async function GET(req: Request) {
  const user = await resolveApiUser(req);
  if (!user) return jsonError("Unauthorized", 401);
  return jsonOk({ user });
}

/** Issue opaque Bearer for Expo secure store (requires existing session cookie). */
export async function POST(req: Request) {
  const user = await resolveApiUser(req);
  if (!user) return jsonError("Unauthorized", 401);
  if (!can(user.role, "game:read")) return jsonError("Forbidden", 403);
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const issued = await issueApiBearerToken(user.id, body.name ?? "Expo");
  return jsonOk({
    token: issued.token,
    expiresAt: issued.expiresAt.toISOString(),
    user,
  });
}
