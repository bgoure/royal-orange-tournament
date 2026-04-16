"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ALL_DIVISIONS_TAB_ID } from "@/lib/division-tabs";
import { DIVISION_TAB_COOKIE } from "@/lib/division-tab-utils";
import { TOURNAMENT_SLUG_COOKIE } from "@/lib/tournament-context";

const cookieOpts = {
  path: "/",
  maxAge: 60 * 60 * 24 * 400,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/** Persists division filter across pages/sessions. Pass `all` or empty to clear. */
export async function setSelectedDivisionTabId(tabId: string, tournamentSlug: string) {
  const c = await cookies();
  const t = tabId.trim();
  if (!t || t === ALL_DIVISIONS_TAB_ID) {
    c.delete(DIVISION_TAB_COOKIE);
  } else if (/^[\w-]{1,128}$/.test(t)) {
    c.set(DIVISION_TAB_COOKIE, t, cookieOpts);
  } else {
    return { ok: false as const, error: "invalid_division_tab" as const };
  }
  revalidatePath("/", "layout");
  revalidatePath(`/${tournamentSlug}`, "layout");
  return { ok: true as const };
}

export async function setSelectedTournamentSlug(slug: string) {
  const exists = await prisma.tournament.findFirst({
    where: {
      slug: { equals: slug, mode: "insensitive" },
      isPublished: true,
    },
    select: { slug: true },
  });
  if (!exists) return { ok: false as const };

  const c = await cookies();
  c.set(TOURNAMENT_SLUG_COOKIE, exists.slug, cookieOpts);
  c.delete(DIVISION_TAB_COOKIE);

  revalidatePath("/", "layout");
  const { revalidatePublishedTournamentSites } = await import("@/lib/revalidate-public-tournament-site");
  await revalidatePublishedTournamentSites();
  return { ok: true as const };
}
