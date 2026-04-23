"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { prisma } from "@/lib/db";
import { assertContentManage, contentCtx, contentDeny, type ContentActionResult } from "./content-shared";

function parseShowFlag(formData: FormData, key: string): boolean | null {
  const v = formData.get(key);
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export async function updateShowPublicSponsorsSection(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  void _prev;
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const show = parseShowFlag(formData, "showPublicSponsorsSection");
  if (show === null) return { ok: false, error: "Invalid value" };

  try {
    await prisma.tournament.update({
      where: { id: c.tournament.id },
      data: { showPublicSponsorsSection: show },
    });
    revalidatePath("/admin/sponsors");
    await revalidatePublishedTournamentSites();
    return { ok: true, notice: show ? "Sponsors section is visible on the home page." : "Sponsors section is hidden on the home page." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}

export async function updateShowPublicFaqSection(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  void _prev;
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const show = parseShowFlag(formData, "showPublicFaqSection");
  if (show === null) return { ok: false, error: "Invalid value" };

  try {
    await prisma.tournament.update({
      where: { id: c.tournament.id },
      data: { showPublicFaqSection: show },
    });
    revalidatePath("/admin/faq");
    await revalidatePublishedTournamentSites();
    return {
      ok: true,
      notice: show ? "FAQ is visible on the public Rules page." : "FAQ is hidden on the public Rules page.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}
