"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { prisma } from "@/lib/db";
import { ADMIN_TOURNAMENT_SLUG_COOKIE, TOURNAMENT_SLUG_COOKIE } from "@/lib/tournament-context";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";
import { cookies } from "next/headers";
import {
  assertContentManage,
  contentCtx,
  contentDeny,
  type ContentActionResult,
} from "@/app/admin/_actions/content-shared";
import { softResetTournamentProgressForId } from "@/lib/services/tournament-soft-reset";

function normalizeArchiveFolder(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t.length < 1 || t.length > 64) {
    return { ok: false, error: "Archive folder must be 1–64 characters." };
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(t)) {
    return {
      ok: false,
      error: "Archive folder may contain letters, numbers, and hyphens only (e.g. 10U11U-2026).",
    };
  }
  return { ok: true, value: t };
}

async function revalidateTournamentLayouts(t: {
  slug: string;
  archiveFolder: string | null;
  archivedAt: Date | null;
}) {
  const base = tournamentPublicBasePath(t);
  revalidatePath("/", "layout");
  revalidatePath(base, "layout");
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

  try {
    await softResetTournamentProgressForId(tournamentId);

    const fresh = await prisma.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { slug: true, archiveFolder: true, archivedAt: true },
    });
    await revalidateTournamentLayouts(fresh);
    return {
      ok: true,
      notice:
        "Tournament reset to pre-play: scores cleared, all games set to scheduled, standings recomputed, bracket slots restored from pool order.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Soft reset failed" };
  }
}

/** Move tournament off the live switcher; public URL becomes /past/{archiveFolder}/{slug}. ADMIN only. */
export async function archiveTournament(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  void _prev;
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (c.session.user.role !== Role.ADMIN) {
    return { ok: false, error: "Only administrators can archive a tournament." };
  }

  if (c.tournament.archivedAt != null) {
    return { ok: false, error: "This tournament is already archived." };
  }

  const understand = formData.get("confirmArchive");
  if (understand !== "on") {
    return { ok: false, error: "Confirm that you understand archiving removes this event from the live switcher." };
  }

  const folderRaw = String(formData.get("archiveFolder") ?? "");
  const normalized = normalizeArchiveFolder(folderRaw);
  if (!normalized.ok) return { ok: false, error: normalized.error };

  const tournamentId = c.tournament.id;
  const prevPath = tournamentPublicBasePath(c.tournament);

  try {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        archivedAt: new Date(),
        archiveFolder: normalized.value,
      },
    });

    const fresh = await prisma.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { slug: true, archiveFolder: true, archivedAt: true },
    });
    const nextPath = tournamentPublicBasePath(fresh);

    revalidatePath(prevPath, "layout");
    revalidatePath(nextPath, "layout");
    revalidatePath("/admin/tournament-settings");
    revalidatePath("/admin", "layout");
    await revalidatePublishedTournamentSites();

    const jar = await cookies();
    const selected = jar.get(TOURNAMENT_SLUG_COOKIE)?.value;
    if (selected && selected.toLowerCase() === c.tournament.slug.toLowerCase()) {
      jar.delete(TOURNAMENT_SLUG_COOKIE);
    }
    const adminSel = jar.get(ADMIN_TOURNAMENT_SLUG_COOKIE)?.value;
    if (adminSel && adminSel.toLowerCase() === c.tournament.slug.toLowerCase()) {
      jar.delete(ADMIN_TOURNAMENT_SLUG_COOKIE);
    }

    return {
      ok: true,
      notice: `Archived. Public history URL: ${nextPath} (live /${c.tournament.slug} no longer works).`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Archive failed" };
  }
}

/** Restore archived tournament to the live switcher. ADMIN only. */
export async function restoreArchivedTournament(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  void _prev;
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (c.session.user.role !== Role.ADMIN) {
    return { ok: false, error: "Only administrators can restore a tournament." };
  }

  if (c.tournament.archivedAt == null) {
    return { ok: false, error: "This tournament is not archived." };
  }

  const confirm = formData.get("confirmRestore");
  if (confirm !== "on") {
    return { ok: false, error: "Confirm restore to bring this event back to the live site." };
  }

  const tournamentId = c.tournament.id;
  const archivedPath = tournamentPublicBasePath(c.tournament);

  try {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        archivedAt: null,
        archiveFolder: null,
      },
    });

    const fresh = await prisma.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { slug: true, archiveFolder: true, archivedAt: true },
    });
    const livePath = tournamentPublicBasePath(fresh);

    revalidatePath(archivedPath, "layout");
    revalidatePath(livePath, "layout");
    revalidatePath("/admin/tournament-settings");
    await revalidatePublishedTournamentSites();

    return {
      ok: true,
      notice: `Restored to live site at ${livePath}.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restore failed" };
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
  const publicPath = tournamentPublicBasePath(c.tournament);

  try {
    await prisma.tournament.delete({ where: { id: tournamentId } });

    const jar = await cookies();
    const selected = jar.get(TOURNAMENT_SLUG_COOKIE)?.value;
    if (selected && selected.toLowerCase() === slug.toLowerCase()) {
      jar.delete(TOURNAMENT_SLUG_COOKIE);
    }
    const adminSel = jar.get(ADMIN_TOURNAMENT_SLUG_COOKIE)?.value;
    if (adminSel && adminSel.toLowerCase() === slug.toLowerCase()) {
      jar.delete(ADMIN_TOURNAMENT_SLUG_COOKIE);
    }

    revalidatePath("/", "layout");
    revalidatePath(publicPath, "layout");
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
