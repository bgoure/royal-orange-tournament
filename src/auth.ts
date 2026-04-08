import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // Prisma adapter types can disagree across nested @auth/core copies; runtime is correct.
  adapter: googleConfigured ? (PrismaAdapter(prisma) as never) : undefined,
  session: { strategy: googleConfigured ? "database" : "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : [
          Credentials({
            id: "credentials-disabled",
            name: "Sign-in not configured",
            credentials: {},
            authorize: async () => null,
          }),
        ]),
  ],
  callbacks: {
    async session({ session, user, token }) {
      if (googleConfigured && user && session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
        return session;
      }
      if (!googleConfigured && session.user && token) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as UserRole | undefined) ?? "USER";
      }
      return session;
    },
    async jwt({ token, user }) {
      if (!googleConfigured && user && "role" in user) {
        token.role = user.role as UserRole;
      }
      return token;
    },
  },
});
