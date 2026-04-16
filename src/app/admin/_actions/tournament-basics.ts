"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { tournamentRenameSchema } from "@/lib/validations/content-admin";
import { assertContentManage, contentCtx, contentDeny, type ContentActionResult } from "./content-shared";

export async function updateTournamentName(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const parsed = tournamentRenameSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid name" };
  }

  try {
    await prisma.tournament.update({
      where: { id: c.tournament.id },
      data: { name: parsed.data.name },
    });
    revalidatePath("/", "layout");
    await revalidatePublishedTournamentSites();
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/tournament-settings");
    return { ok: true, notice: "Tournament name updated." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update name" };
  }
}
