"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { assertContentManage, contentCtx, contentDeny, type ContentActionResult } from "./content-shared";

export type { ContentActionResult };

export async function setTournamentPublished(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const raw = formData.get("published")?.toString();
  const published = raw === "1" || raw === "true";

  try {
    await prisma.tournament.update({
      where: { id: c.tournament.id },
      data: { isPublished: published },
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/tournament-settings");
    await revalidatePublishedTournamentSites();
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
