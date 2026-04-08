"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { TOURNAMENT_SLUG_COOKIE } from "@/lib/tournament-context";

export async function setSelectedTournamentSlug(slug: string) {
  const exists = await prisma.tournament.findFirst({
    where: { slug, isPublished: true },
    select: { slug: true },
  });
  if (!exists) return { ok: false as const };

  (await cookies()).set(TOURNAMENT_SLUG_COOKIE, slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}
