"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { tournamentRenameSchema, tournamentPublicSwitcherOrderSchema } from "@/lib/validations/content-admin";
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

export async function updateTournamentPublicSwitcherOrder(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const parsed = tournamentPublicSwitcherOrderSchema.safeParse({
    publicSwitcherOrder: formData.get("publicSwitcherOrder"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid order",
    };
  }

  try {
    await prisma.tournament.update({
      where: { id: c.tournament.id },
      data: { publicSwitcherOrder: parsed.data.publicSwitcherOrder },
    });
    revalidatePath("/", "layout");
    await revalidatePublishedTournamentSites();
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/tournament-settings");
    return { ok: true, notice: "Public switcher order saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}

/** Hub table: update order for a tournament by id (ADMIN content:manage only). */
export async function updateTournamentPublicSwitcherOrderFromHub(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  void _prev;
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!assertContentManage(session.user.role)) return contentDeny();

  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  if (!tournamentId) return { ok: false, error: "Missing tournament" };

  const parsed = tournamentPublicSwitcherOrderSchema.safeParse({
    publicSwitcherOrder: formData.get("publicSwitcherOrder"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid order",
    };
  }

  const row = await prisma.tournament.findFirst({
    where: { id: tournamentId, isPublished: true },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "Tournament not found" };

  try {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { publicSwitcherOrder: parsed.data.publicSwitcherOrder },
    });
    revalidatePath("/", "layout");
    await revalidatePublishedTournamentSites();
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/tournament-settings");
    return { ok: true, notice: "Public switcher order saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}

/** Form `action` for hub table — Next.js form actions use a single `FormData` argument. */
export async function submitHubPublicSwitcherOrder(formData: FormData): Promise<void> {
  await updateTournamentPublicSwitcherOrderFromHub(undefined, formData);
}

export async function updatePublicAnnouncementsVisibility(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const showPublicAnnouncements = formData.get("showPublicAnnouncements") === "on";

  try {
    await prisma.tournament.update({
      where: { id: c.tournament.id },
      data: { showPublicAnnouncements },
    });
    revalidatePath("/", "layout");
    await revalidatePublishedTournamentSites();
    revalidatePath("/admin/tournament-settings");
    return {
      ok: true,
      notice: showPublicAnnouncements
        ? "Announcements are visible on the public site."
        : "Announcements are hidden on the public site.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update setting" };
  }
}
