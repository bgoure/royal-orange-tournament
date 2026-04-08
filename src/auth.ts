import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { prisma } from "@/lib/db";

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Prisma adapter types can disagree across nested @auth/core copies; runtime is correct.
  adapter: googleConfigured ? (PrismaAdapter(prisma) as never) : undefined,
  /* Edge middleware cannot use DB sessions (no adapter). JWT keeps User/Account in Prisma; cookie is a JWT. */
  session: { strategy: "jwt" },
});
