import type { Team } from "@prisma/client";

/** Logo metadata when `data` is not loaded (public lists). */
export type TeamPublicLogo = {
  mimeType: string;
  updatedAt: Date;
};

export type TeamWithPublicLogo = Team & {
  logo: TeamPublicLogo | null;
};

/** Cache-busting query keeps browsers from showing a stale image after replace. */
export function teamLogoUrl(teamId: string, updatedAt: Date | string): string {
  const v = typeof updatedAt === "string" ? new Date(updatedAt).getTime() : updatedAt.getTime();
  return `/api/team-logo/${teamId}?v=${v}`;
}

/** Prisma nested include: loads team scalars + logo metadata only (not bytes). */
export const teamWithPublicLogoInclude = {
  include: {
    logo: { select: { mimeType: true, updatedAt: true } },
  },
} as const;
