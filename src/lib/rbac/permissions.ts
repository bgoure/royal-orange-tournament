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
]);

const publicPerms: ReadonlySet<Permission> = new Set(["game:read", "team:read"]);

function permissionsForRole(role: Role): ReadonlySet<Permission> {
  switch (role) {
    case "ADMIN":
      return admin;
    case "POWER_USER":
      return powerUser;
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
