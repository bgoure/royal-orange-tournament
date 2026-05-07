import { auth } from "@/auth";
import { getTournamentForRequest, type TournamentForRequest } from "@/lib/tournament-context";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";
import type { Session } from "next-auth";

export type ContentActionResult = { ok: true; notice?: string } | { ok: false; error: string };

export async function contentCtx(): Promise<
  { session: Session; tournament: TournamentForRequest } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const tournament = await getTournamentForRequest();
  if (!tournament) {
    return {
      error: "Open All tournaments in the admin sidebar, pick an event, or use the public site switcher.",
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
