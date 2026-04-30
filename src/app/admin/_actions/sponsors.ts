"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { prisma } from "@/lib/db";
import {
  assertContentManage,
  contentCtx,
  contentDeny,
  type ContentActionResult,
} from "@/app/admin/_actions/content-shared";
import { MAX_TOURNAMENT_SPONSORS } from "@/lib/sponsors-constants";

const MAX_SPONSOR_LOGO_BYTES = 400_000;
const ALLOWED_SPONSOR_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

async function assertSponsorInTournament(
  sponsorId: string,
  tournamentId: string,
): Promise<ContentActionResult | null> {
  const row = await prisma.tournamentSponsor.findFirst({
    where: { id: sponsorId, tournamentId },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "Sponsor not found." };
  return null;
}

export async function uploadTournamentSponsorLogo(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image file (PNG, JPEG, or WebP)." };
  }

  const count = await prisma.tournamentSponsor.count({
    where: { tournamentId: c.tournament.id },
  });
  if (count >= MAX_TOURNAMENT_SPONSORS) {
    return { ok: false, error: `You can add at most ${MAX_TOURNAMENT_SPONSORS} sponsors.` };
  }

  if (file.size > MAX_SPONSOR_LOGO_BYTES) {
    return { ok: false, error: "Image must be 400KB or smaller." };
  }
  const mimeType = file.type;
  if (!ALLOWED_SPONSOR_MIME.has(mimeType)) {
    return { ok: false, error: "Use PNG, JPEG, or WebP." };
  }

  const agg = await prisma.tournamentSponsor.aggregate({
    where: { tournamentId: c.tournament.id },
    _max: { sortOrder: true },
  });
  const nextOrder = (agg._max.sortOrder ?? -1) + 1;

  const buf = Buffer.from(await file.arrayBuffer());

  await prisma.tournamentSponsor.create({
    data: {
      tournamentId: c.tournament.id,
      sortOrder: nextOrder,
      mimeType,
      data: buf,
    },
  });

  revalidatePath("/admin/sponsors");
  await revalidatePublishedTournamentSites();
  return { ok: true };
}

export async function deleteTournamentSponsor(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const sponsorId = formData.get("sponsorId")?.toString();
  if (!sponsorId) return { ok: false, error: "Missing sponsor." };

  const bad = await assertSponsorInTournament(sponsorId, c.tournament.id);
  if (bad) return bad;

  await prisma.tournamentSponsor.delete({ where: { id: sponsorId } });

  revalidatePath("/admin/sponsors");
  await revalidatePublishedTournamentSites();
  return { ok: true };
}

export async function updateSponsorDivisionAssignments(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const sponsorId = formData.get("sponsorId")?.toString();
  if (!sponsorId) return { ok: false, error: "Missing sponsor." };

  const bad = await assertSponsorInTournament(sponsorId, c.tournament.id);
  if (bad) return bad;

  const divisionIdsRaw = formData.getAll("divisionId").map((v) => v.toString()).filter(Boolean);
  const divisionIds = [...new Set(divisionIdsRaw)];

  if (divisionIds.length > 0) {
    const count = await prisma.division.count({
      where: { tournamentId: c.tournament.id, id: { in: divisionIds } },
    });
    if (count !== divisionIds.length) {
      return { ok: false, error: "Invalid division selection." };
    }
  }

  await prisma.$transaction([
    prisma.tournamentSponsorDivision.deleteMany({ where: { sponsorId } }),
    ...(divisionIds.length > 0
      ? [
          prisma.tournamentSponsorDivision.createMany({
            data: divisionIds.map((divisionId) => ({ sponsorId, divisionId })),
          }),
        ]
      : []),
  ]);

  revalidatePath("/admin/sponsors");
  await revalidatePublishedTournamentSites();
  return { ok: true };
}
