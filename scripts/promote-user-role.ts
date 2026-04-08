/**
 * Promote (or demote) a user by email. Run against any database via DATABASE_URL.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/promote-user-role.ts you@gmail.com ADMIN
 *
 * After changing role in production, the user should sign out and sign in again so the JWT updates.
 */
import { PrismaClient, type Role } from "@prisma/client";

const ROLES: Role[] = ["PUBLIC", "POWER_USER", "ADMIN"];

function usage(): never {
  console.error(
    "Usage: npx tsx scripts/promote-user-role.ts <email> <ADMIN|POWER_USER|PUBLIC>\n" +
      "Example: npx tsx scripts/promote-user-role.ts coach@example.com ADMIN",
  );
  process.exit(1);
}

async function main() {
  const emailRaw = process.argv[2];
  const roleRaw = process.argv[3]?.toUpperCase();
  if (!emailRaw?.trim() || !roleRaw) usage();
  const email = emailRaw.trim();
  const role = ROLES.find((r) => r === roleRaw);
  if (!role) usage();

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!user) {
      console.error(`No user found with email matching: ${email}`);
      console.error("Sign in with Google once so Auth.js creates the User row, then run this again.");
      process.exit(1);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { role },
    });
    console.log(`Updated ${user.email} → role ${role}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
