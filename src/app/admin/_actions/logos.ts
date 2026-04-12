"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertContentManage, contentCtx, contentDeny, type ContentActionResult } from "./content-shared";

export async function updateTournamentLogo(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const logoUrl = (formData.get("logoUrl") as string)?.trim() || null;

  try {
    await prisma.tournament.update({
      where: { id: c.tournament.id },
      data: { logoUrl },
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
    return { ok: true, notice: "Tournament logo updated." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update logo" };
  }
}

export async function updateTeamLogo(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const teamId = formData.get("teamId") as string;
  const logoUrl = (formData.get("logoUrl") as string)?.trim() || null;

  if (!teamId) return { ok: false, error: "Team ID is required." };

  try {
    await prisma.team.update({
      where: { id: teamId },
      data: { logoUrl },
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin/teams");
    return { ok: true, notice: "Team logo updated." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update team logo" };
  }
}
