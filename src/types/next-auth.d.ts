import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    /** Epoch ms of last DB role refresh (JWT freshness throttle). */
    roleCheckedAt?: number;
  }
}

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
    };
  }

  interface User {
    role: Role;
  }
}
