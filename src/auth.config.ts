import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);

/**
 * Edge-safe auth configuration (no Prisma / adapter). Used by `middleware.ts`.
 * Full Node setup with adapter lives in `auth.ts`.
 */
export default {
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: googleConfigured ? "database" : "jwt" },
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
        session.user.role = (token.role as "PUBLIC" | "POWER_USER" | "ADMIN" | undefined) ?? "PUBLIC";
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user && "role" in user) {
        token.role = user.role as "PUBLIC" | "POWER_USER" | "ADMIN";
      }
      return token;
    },
  },
} satisfies NextAuthConfig;
