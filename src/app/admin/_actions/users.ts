"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { countAdmins } from "@/lib/services/users-admin";
import { sendStaffInviteEmail } from "@/lib/email/user-invite-email";
import { inviteUserSchema, removeUserSchema, updateUserRoleSchema } from "@/lib/validations/users-admin";

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

function roleInviteLabel(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "POWER_USER":
      return "Power user";
    case "PUBLIC":
      return "Public";
    default:
      return role;
  }
}

export async function inviteUser(
  _prev: UserAdminActionResult | undefined,
  formData: FormData,
): Promise<UserAdminActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!can(session.user.role, "user:manageRoles")) return deny();

  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { ok: false, error: "A user with this email already exists." };
  }

  try {
    await prisma.user.create({
      data: {
        email,
        name: parsed.data.name ?? null,
        role: parsed.data.role,
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create user" };
  }

  const base =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const signInUrl = base ? `${base.replace(/\/$/, "")}/login` : "/login";

  const sent = await sendStaffInviteEmail({
    to: email,
    displayName: parsed.data.name ?? null,
    roleLabel: roleInviteLabel(parsed.data.role),
    signInUrl,
  });

  revalidatePath("/admin/users");
  if (!sent.ok) {
    return {
      ok: true,
      notice: `User added. Invite email was not sent (${sent.error}). They can still sign in with Google using this email.`,
    };
  }
  return { ok: true, notice: "User added and invite email sent." };
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
