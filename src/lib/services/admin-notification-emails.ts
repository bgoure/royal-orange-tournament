import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Distinct non-empty emails for users with the ADMIN role (for system notifications). */
export async function listAdminNotificationEmails(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { role: Role.ADMIN, email: { not: null } },
    select: { email: true },
  });

  const byLower = new Map<string, string>();
  for (const r of rows) {
    const raw = r.email?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, raw);
  }

  return [...byLower.values()];
}
