import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { Role } from "@prisma/client";
import authConfig from "@/auth.config";
import { prisma } from "@/lib/db";
import { normalizeAuthEnvUrls } from "@/lib/normalize-auth-env";

normalizeAuthEnvUrls();

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Prisma adapter types can disagree across nested @auth/core copies; runtime is correct.
  adapter: googleConfigured ? (PrismaAdapter(prisma) as never) : undefined,
  /* Edge middleware cannot use DB sessions (no adapter). JWT keeps User/Account in Prisma; cookie is a JWT. */
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      const uid = user && "id" in user && typeof (user as { id: unknown }).id === "string" ? (user as { id: string }).id : null;
      if (uid) {
        const row = await prisma.user.findUnique({ where: { id: uid }, select: { role: true } });
        if (row) token.role = row.role;
      } else if (token.sub && (token.role === undefined || token.role === null)) {
        const row = await prisma.user.findUnique({ where: { id: token.sub }, select: { role: true } });
        if (row) token.role = row.role as Role;
      }
      return token;
    },
  },
});
