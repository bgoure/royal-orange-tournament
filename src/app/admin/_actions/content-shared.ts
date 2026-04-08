import { auth } from "@/auth";
import { getTournamentForRequest } from "@/lib/tournament-context";
import { can } from "@/lib/rbac/permissions";
import type { Role, Tournament } from "@prisma/client";
import type { Session } from "next-auth";

export type ContentActionResult = { ok: true; notice?: string } | { ok: false; error: string };

export async function contentCtx(): Promise<{ session: Session; tournament: Tournament } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const tournament = await getTournamentForRequest();
  if (!tournament) {
    return {
      error: "Select a tournament on the public site (tournament switcher), then return here.",
    };
  }
  return { session, tournament };
}

export function contentDeny(): ContentActionResult {
  return { ok: false, error: "You don’t have permission for this action." };
}

export function assertContentManage(role: Role): boolean {
  return can(role, "content:manage");
}
