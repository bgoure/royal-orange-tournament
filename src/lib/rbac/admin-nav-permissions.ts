import type { Role } from "@prisma/client";
import { can, type Permission } from "@/lib/rbac/permissions";
import {
  adminNavGroups,
  type AdminNavGroup,
  type AdminNavItem,
} from "@/components/admin/admin-nav";

/** Map nav segments to the permission required to see them (if any). */
const segmentPermission: Partial<Record<string, Permission>> = {
  hub: "game:read",
  "setup-progress": "content:manage",
  "publish-status": "content:manage",
  "tournament-info": "content:manage",
  "tournament-settings": "content:manage",
  "tournament-archive": "content:manage",
  structure: "division:update",
  divisions: "division:update",
  teams: "team:read",
  locations: "content:manage",
  fields: "content:manage",
  games: "game:read",
  "games-scorekeeper": "game:update",
  standings: "standings:configureRules",
  brackets: "bracket:configure",
  "print-sheets": "game:read",
  announcements: "announcement:create",
  faq: "content:manage",
  sponsors: "content:manage",
  users: "user:manageRoles",
};

function canSeeSegment(role: Role, segment: string): boolean {
  if (segment === "brackets") {
    return can(role, "bracket:configure") || can(role, "bracket:pushAndReset");
  }
  if (segment === "standings") {
    return can(role, "standings:configureRules") || can(role, "game:update");
  }
  if (segment === "announcements") {
    return can(role, "announcement:create") || can(role, "announcement:update");
  }
  if (segment === "structure" || segment === "divisions") {
    return (
      can(role, "division:create") ||
      can(role, "division:update") ||
      can(role, "division:delete")
    );
  }
  if (
    segment === "tournament-settings" ||
    segment === "tournament-info" ||
    segment === "tournament-archive" ||
    segment === "setup-progress" ||
    segment === "publish-status" ||
    segment === "locations" ||
    segment === "fields" ||
    segment === "faq" ||
    segment === "sponsors"
  ) {
    return can(role, "content:manage");
  }
  const perm = segmentPermission[segment];
  if (!perm) return true;
  return can(role, perm);
}

export function filterAdminNavForRole(role: Role | undefined | null): AdminNavGroup[] {
  if (!role) return [];
  const groups: AdminNavGroup[] = [];
  for (const group of adminNavGroups) {
    const items = (group.items as readonly AdminNavItem[]).filter((item) =>
      canSeeSegment(role, item.segment),
    );
    if (items.length === 0) continue;
    if (role === "SCOREKEEPER") {
      const skItems = items.filter(
        (i) => i.segment === "games-scorekeeper" || i.segment === "hub",
      );
      if (skItems.length === 0) continue;
      groups.push({ id: group.id, label: group.label, items: skItems });
      continue;
    }
    groups.push({ id: group.id, label: group.label, items });
  }
  return groups;
}
