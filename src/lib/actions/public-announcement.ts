"use server";

import { revalidatePath } from "next/cache";
import { AnnouncementEmailStatus, type Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { deliverAnnouncementEmail } from "@/lib/services/announcement-email";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { getPublishedTournamentBySlugForActions } from "@/lib/tournament-context";
import { announcementUpdateSchema } from "@/lib/validations/announcements-admin";

export type PublicAnnouncementResult = { ok: true; notice?: string } | { ok: false; error: string };

function deny(msg: string): PublicAnnouncementResult {
  return { ok: false, error: msg };
}

type AnnouncementCtxOk = { tournamentId: string; slug: string; role: Role };

async function assertStaffAnnouncementContext(
  formData: FormData,
  permission: "announcement:update" | "announcement:delete",
): Promise<AnnouncementCtxOk | PublicAnnouncementResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return deny("You must be signed in.");
  if (!can(session.user.role, permission)) {
    return deny(
      permission === "announcement:delete"
        ? "Only administrators can delete announcements here."
        : "You don’t have permission to edit announcements.",
    );
  }

  const slug = String(formData.get("tournamentSlug") ?? "").trim();
  if (!slug) return deny("Missing tournament.");

  const tournament = await getPublishedTournamentBySlugForActions(slug);
  if (!tournament) return deny("Tournament not found.");

  return { tournamentId: tournament.id, slug: tournament.slug, role: session.user.role };
}

function isCtxOk(v: AnnouncementCtxOk | PublicAnnouncementResult): v is AnnouncementCtxOk {
  return "tournamentId" in v && "slug" in v;
}

export async function updatePublicAnnouncementFromSite(
  _prev: PublicAnnouncementResult | undefined,
  formData: FormData,
): Promise<PublicAnnouncementResult> {
  const ctx = await assertStaffAnnouncementContext(formData, "announcement:update");
  if (!isCtxOk(ctx)) return ctx;

  const parsed = announcementUpdateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    body: formData.get("body"),
    priority: (formData.get("priority") === "on" ? "on" : "off") as "on" | "off",
    publishedAt: formData.get("publishedAt")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const sendEmail = formData.get("sendEmail") === "on";
  let publishedAt: Date | undefined;
  if (parsed.data.publishedAt) {
    const d = new Date(parsed.data.publishedAt);
    if (!Number.isNaN(d.getTime())) publishedAt = d;
  }

  try {
    const existing = await prisma.announcement.findFirst({
      where: { id: parsed.data.id, tournamentId: ctx.tournamentId },
    });
    if (!existing) return deny("Announcement not found.");

    await prisma.announcement.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        body: parsed.data.body,
        priority: parsed.data.priority ?? false,
        notifySubscribers:
          sendEmail || existing.emailDeliveryStatus === AnnouncementEmailStatus.SENT,
        ...(publishedAt ? { publishedAt } : {}),
      },
    });

    await deliverAnnouncementEmail(
      parsed.data.id,
      sendEmail && existing.emailDeliveryStatus !== AnnouncementEmailStatus.SENT,
    );

    const fresh = await prisma.announcement.findUnique({
      where: { id: parsed.data.id },
      select: { emailDeliveryStatus: true },
    });

    revalidatePath(`/${ctx.slug}`, "layout");
    revalidatePath(`/${ctx.slug}/announcements`);
    revalidatePath("/admin/announcements");
    await revalidatePublishedTournamentSites();

    let notice: string | undefined;
    if (sendEmail) {
      if (fresh?.emailDeliveryStatus === "SENT")
        notice =
          existing.emailDeliveryStatus === "SENT"
            ? "Saved. Email was already sent earlier; no duplicate send."
            : "Email sent.";
      else if (fresh?.emailDeliveryStatus === "SKIPPED_NO_SUBSCRIBERS")
        notice = "Saved. No matching subscribers — no email sent.";
      else if (fresh?.emailDeliveryStatus === "SKIPPED_NO_API_KEY")
        notice = "Saved. Email skipped (Resend not configured).";
      else if (fresh?.emailDeliveryStatus === "FAILED") notice = "Saved. Email failed.";
    }
    return { ok: true, notice };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update announcement" };
  }
}

export async function deletePublicAnnouncementFromSite(
  _prev: PublicAnnouncementResult | undefined,
  formData: FormData,
): Promise<PublicAnnouncementResult> {
  const ctx = await assertStaffAnnouncementContext(formData, "announcement:delete");
  if (!isCtxOk(ctx)) return ctx;

  const id = formData.get("id")?.toString();
  if (!id) return deny("Missing id");

  try {
    const existing = await prisma.announcement.findFirst({
      where: { id, tournamentId: ctx.tournamentId },
    });
    if (!existing) return deny("Announcement not found.");

    await prisma.announcement.delete({ where: { id } });
    revalidatePath(`/${ctx.slug}`, "layout");
    revalidatePath(`/${ctx.slug}/announcements`);
    revalidatePath("/admin/announcements");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete" };
  }
}
