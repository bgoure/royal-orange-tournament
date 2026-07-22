import type { Role } from "@prisma/client";

/** Actions enforced in API/server code. Extend as the admin portal grows. */
export type Permission =
  | "game:read"
  | "game:update"
  | "game:delete"
  | "game:create"
  | "division:create"
  | "division:update"
  | "division:delete"
  | "pool:create"
  | "pool:update"
  | "pool:delete"
  | "team:read"
  | "team:create"
  | "team:update"
  | "team:delete"
  | "schedule:update"
  | "announcement:create"
  | "announcement:update"
  | "announcement:delete"
  | "user:manageRoles"
  | "user:read"
  | "bracket:configure"
  /** Apply standings to playoff seeds + reset bracket (scoped to assigned divisions for POWER_USER). */
  | "bracket:pushAndReset"
  | "standings:configureRules"
  | "content:manage";

const admin: ReadonlySet<Permission> = new Set([
  "game:read",
  "game:update",
  "game:delete",
  "game:create",
  "division:create",
  "division:update",
  "division:delete",
  "pool:create",
  "pool:update",
  "pool:delete",
  "team:read",
  "team:create",
  "team:update",
  "team:delete",
  "schedule:update",
  "announcement:create",
  "announcement:update",
  "announcement:delete",
  "user:manageRoles",
  "user:read",
  "bracket:configure",
  "standings:configureRules",
  "content:manage",
]);

const powerUser: ReadonlySet<Permission> = new Set([
  "game:read",
  "game:update",
  "game:create",
  "schedule:update",
  "announcement:create",
  "announcement:update",
  "division:create",
  "division:update",
  "pool:create",
  "pool:update",
  "team:read",
  "team:create",
  "team:update",
  "bracket:pushAndReset",
]);

const scorekeeper: ReadonlySet<Permission> = new Set([
  "game:read",
  "game:update",
  "schedule:update",
  "team:read",
]);

const publicPerms: ReadonlySet<Permission> = new Set(["game:read", "team:read"]);

function permissionsForRole(role: Role): ReadonlySet<Permission> {
  switch (role) {
    case "ADMIN":
      return admin;
    case "POWER_USER":
      return powerUser;
    case "SCOREKEEPER":
      return scorekeeper;
    case "PUBLIC":
      return publicPerms;
  }
}

export function can(role: Role, permission: Permission): boolean {
  return permissionsForRole(role).has(permission);
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    const err = new Error(`Forbidden: missing ${permission}`) as Error & { status: number };
    err.status = 403;
    throw err;
  }
}

/**
 * For POWER_USER / SCOREKEEPER: check that the target division is in their assigned set.
 * ADMINs always pass. Returns false for roles without division scope.
 */
export function canAccessDivision(
  role: Role,
  assignedDivisionIds: ReadonlySet<string>,
  targetDivisionId: string,
): boolean {
  if (role === "ADMIN") return true;
  if (role !== "POWER_USER" && role !== "SCOREKEEPER") return false;
  return assignedDivisionIds.has(targetDivisionId);
}

/** Roles that may enter /admin at all. */
export function isStaffRole(role: Role | string | undefined | null): boolean {
  return role === "ADMIN" || role === "POWER_USER" || role === "SCOREKEEPER";
}
