import { prisma } from "@/lib/db";
import { jsonError, jsonOk, resolveApiUser } from "@/lib/api/v1/auth";

/**
 * Register or reassign an Expo push token for the authenticated user.
 * Does not send notifications — registration only.
 */
export async function POST(req: Request) {
  const user = await resolveApiUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (token.length < 8 || token.length > 512) {
    return jsonError("token is required (8–512 characters)", 400);
  }

  const row = await prisma.expoPushToken.upsert({
    where: { token },
    create: { userId: user.id, token },
    update: { userId: user.id },
    select: { id: true, token: true, updatedAt: true },
  });

  return jsonOk({
    pushToken: {
      id: row.id,
      token: row.token,
      updatedAt: row.updatedAt.toISOString(),
    },
  });
}
