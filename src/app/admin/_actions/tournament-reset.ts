"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { prisma } from "@/lib/db";
import { TOURNAMENT_SLUG_COOKIE } from "@/lib/tournament-context";
import { cookies } from "next/headers";
import {
  assertContentManage,
  contentCtx,
  contentDeny,
  type ContentActionResult,
} from "@/app/admin/_actions/content-shared";
import { softResetTournamentProgressForId } from "@/lib/services/tournament-soft-reset";

async function revalidateTournamentAndAdmin(slug: string) {
  revalidatePath("/", "layout");
  revalidatePath(`/${slug}`, "layout");
  revalidatePath("/admin/tournament-settings");
  await revalidatePublishedTournamentSites();
}

/** Clear competitive state; keep structure, branding, announcements, FAQ, subscribers. */
export async function softResetTournamentProgress(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  void _prev;
  const confirm = formData.get("confirmSoftReset");
  if (confirm !== "on") {
    return { ok: false, error: "Confirm the soft reset checkbox first." };
  }

  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const tournamentId = c.tournament.id;
  const slug = c.tournament.slug;

  try {
    await softResetTournamentProgressForId(tournamentId);

    await revalidateTournamentAndAdmin(slug);
    return {
      ok: true,
      notice:
        "Tournament reset to pre-play: scores cleared, standings recomputed, bracket slots restored from pool order.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Soft reset failed" };
  }
}

/** Delete the tournament and all cascaded data. ADMIN only. */
export async function hardDeleteTournament(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  void _prev;
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (c.session.user.role !== Role.ADMIN) {
    return { ok: false, error: "Only administrators can delete a tournament." };
  }

  const understand = formData.get("confirmHardUnderstand");
  if (understand !== "on") {
    return { ok: false, error: "Confirm that you understand this cannot be undone." };
  }

  const typed = String(formData.get("confirmHardPhrase") ?? "").trim();
  const slug = c.tournament.slug;
  if (typed !== slug) {
    return { ok: false, error: `Type the tournament slug exactly (${slug}) to confirm.` };
  }

  const tournamentId = c.tournament.id;

  try {
    await prisma.tournament.delete({ where: { id: tournamentId } });

    const jar = await cookies();
    jar.delete(TOURNAMENT_SLUG_COOKIE);

    revalidatePath("/", "layout");
    revalidatePath(`/${slug}`, "layout");
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/tournament-settings");
    await revalidatePublishedTournamentSites();

    return {
      ok: true,
      notice: "Tournament deleted. Create a new one or select another from the public switcher.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
}
