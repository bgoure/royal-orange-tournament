"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { prisma } from "@/lib/db";
import { adminFieldCreateSchema, adminFieldUpdateSchema } from "@/lib/validations/content-admin";
import { assertContentManage, contentCtx, contentDeny, type ContentActionResult } from "./content-shared";

function nextFieldSortOrder(tournamentId: string, locationId: string) {
  return prisma.field
    .aggregate({
      where: { tournamentId, locationId },
      _max: { sortOrder: true },
    })
    .then((r) => (r._max.sortOrder ?? -1) + 1);
}

async function assertLocationInTournament(locationId: string, tournamentId: string) {
  const loc = await prisma.location.findFirst({
    where: { id: locationId, tournamentId },
    select: { id: true },
  });
  if (!loc) throw new Error("Location not found in this tournament");
}

export async function createField(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const parsed = adminFieldCreateSchema.safeParse({
    name: formData.get("name"),
    locationId: formData.get("locationId"),
    sortOrder: formData.get("sortOrder")?.toString(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  let sortOrder = await nextFieldSortOrder(c.tournament.id, parsed.data.locationId);
  const raw = parsed.data.sortOrder?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n)) sortOrder = n;
  }

  try {
    await assertLocationInTournament(parsed.data.locationId, c.tournament.id);
    await prisma.field.create({
      data: {
        tournamentId: c.tournament.id,
        locationId: parsed.data.locationId,
        name: parsed.data.name,
        sortOrder,
      },
    });
    revalidatePath("/admin/fields");
    revalidatePath("/admin/games");
    revalidatePath("/admin/brackets");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create field" };
  }
}

export async function updateField(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const parsed = adminFieldUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    locationId: formData.get("locationId"),
    sortOrder: formData.get("sortOrder")?.toString(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  let sortOrder: number | undefined;
  const raw = parsed.data.sortOrder?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n)) sortOrder = n;
  }

  try {
    const existing = await prisma.field.findFirst({
      where: { id: parsed.data.id, tournamentId: c.tournament.id },
    });
    if (!existing) return { ok: false, error: "Field not found" };

    await assertLocationInTournament(parsed.data.locationId, c.tournament.id);

    await prisma.field.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        locationId: parsed.data.locationId,
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    });
    revalidatePath("/admin/fields");
    revalidatePath("/admin/games");
    revalidatePath("/admin/brackets");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update field" };
  }
}

export async function deleteField(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const id = formData.get("id")?.toString();
  if (!id) return { ok: false, error: "Missing id" };

  try {
    const existing = await prisma.field.findFirst({
      where: { id, tournamentId: c.tournament.id },
    });
    if (!existing) return { ok: false, error: "Field not found" };

    const gameCount = await prisma.game.count({ where: { fieldId: id } });
    if (gameCount > 0) {
      return {
        ok: false,
        error: `This field is used in ${gameCount} game(s). Change those games to another field or remove them before deleting.`,
      };
    }

    await prisma.field.delete({ where: { id } });
    revalidatePath("/admin/fields");
    revalidatePath("/admin/games");
    revalidatePath("/admin/brackets");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete field" };
  }
}

export async function moveField(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const id = formData.get("id")?.toString();
  const direction = formData.get("direction")?.toString();
  if (!id || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "Invalid move request" };
  }

  try {
    const row = await prisma.field.findFirst({
      where: { id, tournamentId: c.tournament.id },
      select: { id: true, locationId: true, sortOrder: true },
    });
    if (!row) return { ok: false, error: "Field not found" };

    const rows = await prisma.field.findMany({
      where: { tournamentId: c.tournament.id, locationId: row.locationId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, sortOrder: true },
    });
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return { ok: false, error: "Field not found" };
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= rows.length) return { ok: true };

    const a = rows[i];
    const b = rows[j];
    await prisma.$transaction([
      prisma.field.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
      prisma.field.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
    ]);
    revalidatePath("/admin/fields");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to reorder" };
  }
}
