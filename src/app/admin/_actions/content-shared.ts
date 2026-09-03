import { can } from "@/lib/rbac/permissions";
import { requireAuthorizedTournamentContext } from "@/lib/rbac/tenant-access";
import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import type { TournamentForRequest } from "@/lib/tournament-context";

export type ContentActionResult = { ok: true; notice?: string } | { ok: false; error: string };

/**
 * Resolves the cookie-selected tournament, then authorizes org membership
 * (platform ADMIN bypass is centralized in tenant-access).
 * Shared helpers — not a "use server" module (sync helpers must not be Server Actions).
 */
export async function contentCtx(): Promise<
  { session: Session; tournament: TournamentForRequest } | { error: string }
> {
  return requireAuthorizedTournamentContext();
}

export function contentDeny(): ContentActionResult {
  return { ok: false, error: "You don’t have permission for this action." };
}

export function assertContentManage(role: Role): boolean {
  return can(role, "content:manage");
}
