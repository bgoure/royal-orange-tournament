"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { prisma } from "@/lib/db";
import {
  locationCreateSchema,
  locationUpdateSchema,
  parsedOptionalCoordinates,
} from "@/lib/validations/content-admin";
import { assertContentManage, contentCtx, contentDeny, type ContentActionResult } from "./content-shared";

function nextLocationSortOrder(tournamentId: string) {
  return prisma.location
    .aggregate({ where: { tournamentId }, _max: { sortOrder: true } })
    .then((r) => (r._max.sortOrder ?? -1) + 1);
}

function validateLatLon(lat: number | null, lon: number | null): string | null {
  if (lat == null && lon == null) return null;
  if (lat == null || lon == null) return "Enter both latitude and longitude, or leave both blank.";
  if (lat < -90 || lat > 90) return "Latitude must be between -90 and 90.";
  if (lon < -180 || lon > 180) return "Longitude must be between -180 and 180.";
  return null;
}

export async function createVenue(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const parsed = locationCreateSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address")?.toString(),
    latitude: formData.get("latitude")?.toString(),
    longitude: formData.get("longitude")?.toString(),
    mapLink: formData.get("mapLink")?.toString(),
    sortOrder: formData.get("sortOrder")?.toString(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const { latitude, longitude } = parsedOptionalCoordinates(parsed.data.latitude, parsed.data.longitude);
  const coordErr = validateLatLon(latitude, longitude);
  if (coordErr) return { ok: false, error: coordErr };

  let sortOrder = await nextLocationSortOrder(c.tournament.id);
  const raw = parsed.data.sortOrder?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n)) sortOrder = n;
  }

  const emptyToNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

  const existingHq = await prisma.location.findFirst({
    where: { tournamentId: c.tournament.id, isHeadquarters: true },
  });

  try {
    await prisma.location.create({
      data: {
        tournamentId: c.tournament.id,
        name: parsed.data.name,
        address: emptyToNull(parsed.data.address),
        latitude,
        longitude,
        mapLink: emptyToNull(parsed.data.mapLink),
        sortOrder,
        isHeadquarters: !existingHq,
      },
    });
    revalidatePath("/admin/locations");
    await revalidatePublishedTournamentSites();
    revalidatePath("/admin/tournament-settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create location" };
  }
}

export async function updateVenue(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const parsed = locationUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    address: formData.get("address")?.toString(),
    latitude: formData.get("latitude")?.toString(),
    longitude: formData.get("longitude")?.toString(),
    mapLink: formData.get("mapLink")?.toString(),
    sortOrder: formData.get("sortOrder")?.toString(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const { latitude, longitude } = parsedOptionalCoordinates(parsed.data.latitude, parsed.data.longitude);
  const coordErr = validateLatLon(latitude, longitude);
  if (coordErr) return { ok: false, error: coordErr };

  let sortOrder: number | undefined;
  const raw = parsed.data.sortOrder?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n)) sortOrder = n;
  }

  const emptyToNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

  try {
    const existing = await prisma.location.findFirst({
      where: { id: parsed.data.id, tournamentId: c.tournament.id },
    });
    if (!existing) return { ok: false, error: "Location not found" };

    await prisma.location.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        address: emptyToNull(parsed.data.address),
        latitude,
        longitude,
        mapLink: emptyToNull(parsed.data.mapLink),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    });
    revalidatePath("/admin/locations");
    await revalidatePublishedTournamentSites();
    revalidatePath("/admin/tournament-settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update location" };
  }
}

export async function deleteVenue(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const id = formData.get("id")?.toString();
  if (!id) return { ok: false, error: "Missing id" };

  try {
    const existing = await prisma.location.findFirst({
      where: { id, tournamentId: c.tournament.id },
    });
    if (!existing) return { ok: false, error: "Location not found" };

    const fieldCount = await prisma.field.count({ where: { locationId: id } });
    if (fieldCount > 0) {
      return {
        ok: false,
        error: "Reassign or remove fields that use this location before deleting it.",
      };
    }

    const others = await prisma.location.findMany({
      where: { tournamentId: c.tournament.id, id: { not: id } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });

    if (existing.isHeadquarters && others.length === 0) {
      return { ok: false, error: "Cannot delete the only location for this tournament." };
    }

    if (existing.isHeadquarters) {
      const promoted = others[0]!;
      await prisma.$transaction([
        prisma.location.update({
          where: { id: promoted.id },
          data: { isHeadquarters: true },
        }),
        prisma.location.delete({ where: { id } }),
      ]);
    } else {
      await prisma.location.delete({ where: { id } });
    }

    revalidatePath("/admin/locations");
    await revalidatePublishedTournamentSites();
    revalidatePath("/admin/tournament-settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete" };
  }
}

export async function moveVenue(
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
    const rows = await prisma.location.findMany({
      where: { tournamentId: c.tournament.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, sortOrder: true },
    });
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return { ok: false, error: "Location not found" };
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= rows.length) return { ok: true };

    const a = rows[i];
    const b = rows[j];
    await prisma.$transaction([
      prisma.location.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
      prisma.location.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
    ]);
    revalidatePath("/admin/locations");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to reorder" };
  }
}

export async function setLocationAsHeadquarters(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const id = formData.get("id")?.toString();
  if (!id) return { ok: false, error: "Missing id" };

  try {
    const loc = await prisma.location.findFirst({
      where: { id, tournamentId: c.tournament.id },
    });
    if (!loc) return { ok: false, error: "Location not found" };

    await prisma.$transaction([
      prisma.location.updateMany({
        where: { tournamentId: c.tournament.id },
        data: { isHeadquarters: false },
      }),
      prisma.location.update({
        where: { id },
        data: { isHeadquarters: true },
      }),
    ]);

    revalidatePath("/admin/locations");
    revalidatePath("/admin/fields");
    await revalidatePublishedTournamentSites();
    revalidatePath("/admin/tournament-settings");
    return { ok: true, notice: "Headquarters location updated." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to set headquarters" };
  }
}
