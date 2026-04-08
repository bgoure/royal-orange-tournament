"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { countAdmins } from "@/lib/services/users-admin";
import { removeUserSchema, updateUserRoleSchema } from "@/lib/validations/users-admin";

export type UserAdminActionResult = { ok: true; notice?: string } | { ok: false; error: string };

function deny(): UserAdminActionResult {
  return { ok: false, error: "You don’t have permission to manage users." };
}

/**
 * Blocks demotions/deletes that would leave zero admins.
 */
async function assertKeepsAtLeastOneAdmin(opts: {
  targetCurrentRole: Role;
  nextRole?: Role;
  /** true = user row will be removed */
  isDelete: boolean;
}): Promise<UserAdminActionResult | null> {
  if (!opts.isDelete) {
    if (opts.targetCurrentRole !== "ADMIN" || opts.nextRole === "ADMIN") return null;
    const admins = await countAdmins();
    if (admins <= 1) {
      return {
        ok: false,
        error: "Cannot demote the only remaining admin. Promote another admin first.",
      };
    }
    return null;
  }

  if (opts.targetCurrentRole !== "ADMIN") return null;
  const admins = await countAdmins();
  if (admins <= 1) {
    return {
      ok: false,
      error: "Cannot remove the only remaining admin. Promote another admin first.",
    };
  }
  return null;
}

export async function updateUserRole(
  _prev: UserAdminActionResult | undefined,
  formData: FormData,
): Promise<UserAdminActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!can(session.user.role, "user:manageRoles")) return deny();

  const parsed = updateUserRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, role: true },
  });
  if (!target) return { ok: false, error: "User not found" };
  if (target.role === parsed.data.role) return { ok: true };

  const block = await assertKeepsAtLeastOneAdmin({
    targetCurrentRole: target.role,
    nextRole: parsed.data.role,
    isDelete: false,
  });
  if (block) return block;

  try {
    await prisma.user.update({
      where: { id: target.id },
      data: { role: parsed.data.role },
    });
    revalidatePath("/admin/users");
    return { ok: true, notice: "Role updated." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update role" };
  }
}

export async function removeUserAccess(
  _prev: UserAdminActionResult | undefined,
  formData: FormData,
): Promise<UserAdminActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!can(session.user.role, "user:manageRoles")) return deny();

  const parsed = removeUserSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, role: true },
  });
  if (!target) return { ok: false, error: "User not found" };

  const block = await assertKeepsAtLeastOneAdmin({
    targetCurrentRole: target.role,
    isDelete: true,
  });
  if (block) return block;

  try {
    await prisma.user.delete({ where: { id: target.id } });
    revalidatePath("/admin/users");
    return { ok: true, notice: "User removed." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to remove user" };
  }
}
