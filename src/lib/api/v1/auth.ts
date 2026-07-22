import { createHash, randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";
import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export type ApiUser = { id: string; email: string | null; role: Role };

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Issue a new opaque Bearer token for Expo (returns raw once). */
export async function issueApiBearerToken(
  userId: string,
  name = "Expo",
  expiresInDays = 90,
): Promise<{ token: string; expiresAt: Date }> {
  const raw = `th_${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  await prisma.apiBearerToken.create({
    data: {
      userId,
      name,
      tokenHash: hashToken(raw),
      expiresAt,
    },
  });
  return { token: raw, expiresAt };
}

/**
 * Resolve staff user from:
 * 1. `Authorization: Bearer th_…` opaque API token, or
 * 2. Auth.js session cookie via `auth()`.
 */
export async function resolveApiUser(req: Request): Promise<ApiUser | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const raw = authHeader.slice(7).trim();
    if (raw.startsWith("th_")) {
      const row = await prisma.apiBearerToken.findUnique({
        where: { tokenHash: hashToken(raw) },
        include: { user: { select: { id: true, email: true, role: true } } },
      });
      if (row && (!row.expiresAt || row.expiresAt > new Date())) {
        await prisma.apiBearerToken.update({
          where: { id: row.id },
          data: { lastUsedAt: new Date() },
        });
        return { id: row.user.id, email: row.user.email, role: row.user.role };
      }
      return null;
    }
  }

  const session = await auth();
  if (session?.user?.id && session.user.role) {
    return {
      id: session.user.id,
      email: session.user.email ?? null,
      role: session.user.role,
    };
  }
  return null;
}
