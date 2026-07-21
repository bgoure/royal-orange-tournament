"use server";

import { auth } from "@/auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { isReservedTournamentSlug, slugifyTournamentName } from "@/lib/slug";
import {
  tournamentRenameSchema,
  tournamentSlugChangeSchema,
  tournamentPublicSwitcherOrderSchema,
} from "@/lib/validations/content-admin";
import {
  ADMIN_TOURNAMENT_SLUG_COOKIE,
  TOURNAMENT_SLUG_COOKIE,
} from "@/lib/tournament-context";
import { assertContentManage, contentCtx, contentDeny, type ContentActionResult } from "./content-shared";

function rewriteBrandingPath(
  url: string | null | undefined,
  oldSlug: string,
  newSlug: string,
): string | null | undefined {
  if (url == null || url === "") return url;
  const needle = `/branding/${oldSlug}/`;
  const next = `/branding/${newSlug}/`;
  if (!url.includes(needle)) return url;
  return url.split(needle).join(next);
}

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

/**
 * Change the public URL slug. Creates a permanent redirect from the old slug.
 * Does not change the display name.
 */
export async function updateTournamentSlug(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const parsed = tournamentSlugChangeSchema.safeParse({
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid slug" };
  }

  const oldSlug = c.tournament.slug;
  const newSlug = slugifyTournamentName(parsed.data.slug);
  if (newSlug === oldSlug) {
    return { ok: true, notice: "Public URL is already set to that slug." };
  }
  if (isReservedTournamentSlug(newSlug)) {
    return { ok: false, error: `“${newSlug}” is reserved by the app and cannot be used as a URL.` };
  }

  const clash = await prisma.tournament.findFirst({
    where: {
      slug: { equals: newSlug, mode: "insensitive" },
      NOT: { id: c.tournament.id },
    },
    select: { id: true, name: true },
  });
  if (clash) {
    return {
      ok: false,
      error: `That URL is already used by “${clash.name}”. Choose a different slug.`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Reclaim newSlug if it was a former redirect for this (or any) tournament
      await tx.tournamentSlugRedirect.deleteMany({
        where: { fromSlug: { equals: newSlug, mode: "insensitive" } },
      });

      await tx.tournament.update({
        where: { id: c.tournament.id },
        data: {
          slug: newSlug,
          pwaIcon192Url: rewriteBrandingPath(c.tournament.pwaIcon192Url, oldSlug, newSlug),
          pwaIcon512Url: rewriteBrandingPath(c.tournament.pwaIcon512Url, oldSlug, newSlug),
          gameSheetLogoLeftUrl: rewriteBrandingPath(
            c.tournament.gameSheetLogoLeftUrl,
            oldSlug,
            newSlug,
          ),
          gameSheetLogoRightUrl: rewriteBrandingPath(
            c.tournament.gameSheetLogoRightUrl,
            oldSlug,
            newSlug,
          ),
        },
      });

      await tx.tournamentSlugRedirect.upsert({
        where: { fromSlug: oldSlug },
        create: {
          fromSlug: oldSlug,
          tournamentId: c.tournament.id,
        },
        update: {
          tournamentId: c.tournament.id,
        },
      });
    });

    const jar = await cookies();
    const opts = {
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
    };
    jar.set(TOURNAMENT_SLUG_COOKIE, newSlug, opts);
    jar.set(ADMIN_TOURNAMENT_SLUG_COOKIE, newSlug, opts);

    revalidatePath("/", "layout");
    await revalidatePublishedTournamentSites();
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/tournament-settings");
    revalidatePath(`/${oldSlug}`, "layout");
    revalidatePath(`/${newSlug}`, "layout");
    return {
      ok: true,
      notice: `Public URL is now /${newSlug}. Old links to /${oldSlug} redirect here.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update URL" };
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
