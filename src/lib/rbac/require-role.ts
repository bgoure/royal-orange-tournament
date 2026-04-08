import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { auth } from "@/auth";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Require an authenticated session whose role is one of `roles`.
 * Use in Server Components, Server Actions, and Route Handlers (after middleware).
 */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new HttpError("Unauthorized", 401);
  }
  if (!roles.includes(session.user.role)) {
    throw new HttpError("Forbidden", 403);
  }
  return session;
}

/** ADMIN only — full CRUD, user/role management, bracket & standings config */
export async function requireAdmin(): Promise<Session> {
  return requireRole("ADMIN");
}

/** Any staff who may access /admin — POWER_USER or ADMIN */
export async function requireStaff(): Promise<Session> {
  return requireRole("POWER_USER", "ADMIN");
}
