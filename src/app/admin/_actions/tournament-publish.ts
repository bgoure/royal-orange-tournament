"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { assertContentManage, contentCtx, contentDeny, type ContentActionResult } from "./content-shared";

export async function setTournamentPublished(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  try {
    const c = await contentCtx();
    if ("error" in c) return { ok: false, error: c.error };
    if (!assertContentManage(c.session.user.role)) return contentDeny();

    const raw = formData.get("published")?.toString();
    const published = raw === "1" || raw === "true";

    await prisma.tournament.update({
      where: { id: c.tournament.id },
      data: { isPublished: published },
    });

    try {
      revalidatePath("/admin/tournament-settings");
      revalidatePath("/admin", "layout");
      await revalidatePublishedTournamentSites();
    } catch {
      // Publish already persisted; cache revalidation must not fail the action.
    }

    return {
      ok: true,
      notice: published
        ? "Tournament published — it is now on the public site."
        : "Tournament unpublished — it is a draft again.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update publish status" };
  }
}
