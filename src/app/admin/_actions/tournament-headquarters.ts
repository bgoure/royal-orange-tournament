"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  parsedOptionalCoordinates,
  tournamentHeadquartersSchema,
} from "@/lib/validations/content-admin";
import { assertContentManage, contentCtx, contentDeny, type ContentActionResult } from "./content-shared";

function validateLatLon(lat: number | null, lon: number | null): string | null {
  if (lat == null && lon == null) return null;
  if (lat == null || lon == null) return "Enter both latitude and longitude, or leave both blank.";
  if (lat < -90 || lat > 90) return "Latitude must be between -90 and 90.";
  if (lon < -180 || lon > 180) return "Longitude must be between -180 and 180.";
  return null;
}

export async function updateTournamentHeadquarters(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const parsed = tournamentHeadquartersSchema.safeParse({
    headquartersLocationId: formData.get("headquartersLocationId")?.toString(),
    headquartersName: formData.get("headquartersName")?.toString(),
    headquartersAddress: formData.get("headquartersAddress")?.toString(),
    headquartersLatitude: formData.get("headquartersLatitude")?.toString(),
    headquartersLongitude: formData.get("headquartersLongitude")?.toString(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const { latitude, longitude } = parsedOptionalCoordinates(
    parsed.data.headquartersLatitude,
    parsed.data.headquartersLongitude,
  );
  const coordErr = validateLatLon(latitude, longitude);
  if (coordErr) return { ok: false, error: coordErr };

  const targetId = parsed.data.headquartersLocationId.trim();
  const loc = await prisma.location.findFirst({
    where: { id: targetId, tournamentId: c.tournament.id },
  });
  if (!loc) return { ok: false, error: "Location not found for this tournament." };

  const emptyToNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);
  const name = emptyToNull(parsed.data.headquartersName) ?? loc.name;
  const address = emptyToNull(parsed.data.headquartersAddress);

  try {
    await prisma.$transaction([
      prisma.location.updateMany({
        where: { tournamentId: c.tournament.id },
        data: { isHeadquarters: false },
      }),
      prisma.location.update({
        where: { id: targetId },
        data: {
          isHeadquarters: true,
          name,
          address,
          latitude,
          longitude,
        },
      }),
    ]);
    revalidatePath("/admin/tournament-settings");
    revalidatePath("/");
    revalidatePath("/locations");
    return { ok: true, notice: "Tournament headquarters saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save headquarters" };
  }
}
